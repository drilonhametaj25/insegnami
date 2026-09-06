/**
 * Integration-DB: /api/invoices contro Postgres reale.
 *
 * getAuth (@/lib/auth) è l'UNICA cosa mockata della catena auth: requireAuth
 * reale gira sulla session finta dell'admin fixture, e il tenant-guard
 * (getTenantAccessCached) passa perché la fixture ha trialUntil futuro.
 */
jest.mock('@/lib/auth', () => ({
  __esModule: true,
  getAuth: jest.fn(),
  // Helper banali ri-implementati inline: NON usiamo requireActual perché
  // il modulo reale inizializza NextAuth (PrismaAdapter) al load.
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
  isAdminRole: (role?: string) =>
    ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role ?? ''),
  canManage: (role?: string) =>
    ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'].includes(role ?? ''),
}))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { computeInvoiceTotals } from '@/lib/billing/invoice-totals'
import { GET as listInvoices, POST as createInvoice } from '@/app/api/invoices/route'
import { DELETE as deleteInvoice, PATCH as patchInvoice } from '@/app/api/invoices/[id]/route'
import { POST as issueInvoice } from '@/app/api/invoices/[id]/issue/route'
import {
  createTenantFixture,
  buildAdminSession,
  type TenantFixture,
} from './helpers/fixtures'

const mockedGetAuth = getAuth as jest.Mock

const BASE = 'http://localhost:3000/api/invoices'

/** Costruisce una NextRequest JSON reale (duplex richiesto da undici per i body). */
function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] & { duplex?: 'half' } = {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body), duplex: 'half' as const } : {}),
  }
  return new NextRequest(url, init)
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// Due righe con quantità/sconto diversi per esercitare il calcolo totali.
const LINES = [
  { description: 'Retta mensile', quantity: 2, unitPrice: 50, vatRate: 22 },
  { description: 'Quota iscrizione', quantity: 1, unitPrice: 100, vatRate: 10, discountPercent: 10 },
]

describe('API invoices (integration-DB)', () => {
  let fixture: TenantFixture

  beforeAll(async () => {
    fixture = await createTenantFixture(prisma)
  })

  afterAll(async () => {
    await fixture?.destroy()
  })

  beforeEach(() => {
    mockedGetAuth.mockResolvedValue(buildAdminSession(fixture))
  })

  async function createDraft() {
    const res = await createInvoice(
      jsonRequest(BASE, 'POST', {
        seriesId: fixture.seriesId,
        customerProfileId: fixture.customerProfileId,
        lines: LINES,
      }),
    )
    return res
  }

  let issuedInvoiceId: string

  it('POST crea una bozza con 2 righe e totali coerenti con computeInvoiceTotals', async () => {
    const res = await createDraft()
    expect(res.status).toBe(201)
    const { invoice } = await res.json()

    const expected = computeInvoiceTotals(LINES)
    expect(invoice.status).toBe('DRAFT')
    expect(invoice.number).toBe(0) // numero assegnato solo all'emissione
    expect(invoice.lines).toHaveLength(2)
    expect(Number(invoice.subtotal)).toBe(expected.subtotal)
    expect(Number(invoice.vatTotal)).toBe(expected.vatTotal)
    expect(Number(invoice.total)).toBe(expected.total)
    // Totali di riga persistiti = quelli della funzione pura condivisa col client.
    expect(invoice.lines.map((l: { total: string }) => Number(l.total))).toEqual(
      expected.lineTotals,
    )

    issuedInvoiceId = invoice.id
  })

  it('POST issue assegna numero 1; la seconda fattura prende numero 2 (progressivo per serie)', async () => {
    // Prima fattura (bozza del test precedente) → numero 1.
    const res1 = await issueInvoice(
      jsonRequest(`${BASE}/${issuedInvoiceId}/issue`, 'POST'),
      routeParams(issuedInvoiceId),
    )
    expect(res1.status).toBe(200)
    const issued1 = (await res1.json()).invoice
    expect(issued1.status).toBe('ISSUED')
    expect(issued1.number).toBe(1)

    // Seconda bozza nella stessa serie/anno → numero 2.
    const createRes = await createDraft()
    expect(createRes.status).toBe(201)
    const draft2 = (await createRes.json()).invoice
    const res2 = await issueInvoice(
      jsonRequest(`${BASE}/${draft2.id}/issue`, 'POST'),
      routeParams(draft2.id),
    )
    expect(res2.status).toBe(200)
    const issued2 = (await res2.json()).invoice
    expect(issued2.number).toBe(2)
    expect(issued2.year).toBe(issued1.year)
  })

  it('GET lista è scoped sul tenant: le fatture di un secondo tenant non sono visibili', async () => {
    // Fixture B parallela con una fattura creata direttamente via prisma.
    const fixtureB = await createTenantFixture(prisma)
    try {
      const invoiceB = await prisma.invoice.create({
        data: {
          tenantId: fixtureB.tenantId,
          seriesId: fixtureB.seriesId,
          customerProfileId: fixtureB.customerProfileId,
          year: new Date().getUTCFullYear(),
          subtotal: 10,
          vatTotal: 2.2,
          total: 12.2,
          createdBy: fixtureB.adminUser.id,
        },
      })

      // Impersoniamo l'admin del tenant A.
      mockedGetAuth.mockResolvedValue(buildAdminSession(fixture))
      const res = await listInvoices(new NextRequest(`${BASE}?pageSize=100`))
      expect(res.status).toBe(200)
      const body = await res.json()

      const ids = body.invoices.map((i: { id: string }) => i.id)
      expect(ids).not.toContain(invoiceB.id)
      // Tutte le fatture visibili appartengono al tenant A (riscontro su DB).
      const visible = await prisma.invoice.findMany({
        where: { id: { in: ids } },
        select: { tenantId: true },
      })
      expect(visible.every((i) => i.tenantId === fixture.tenantId)).toBe(true)
      expect(body.pagination.total).toBe(ids.length)
    } finally {
      await fixtureB.destroy()
    }
  })

  it('due bozze nello stesso sezionale/anno coesistono (POST non fallisce più: number=0 non è unico)', async () => {
    // In produzione il partial unique WHERE number > 0 lascia coesistere le
    // bozze; qui verifichiamo che la seconda POST non fallisca.
    const res1 = await createDraft()
    const res2 = await createDraft()
    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)

    const inv1 = (await res1.json()).invoice
    const inv2 = (await res2.json()).invoice
    expect(inv1.number).toBe(0)
    expect(inv2.number).toBe(0)
    expect(inv1.seriesId).toBe(inv2.seriesId)
    expect(inv1.year).toBe(inv2.year)
  })

  it('PATCH lines[] su bozza: replace righe + ricalcolo totali server-side', async () => {
    const created = await (await createDraft()).json()
    const draftId = created.invoice.id

    const NEW_LINES = [
      { description: 'Pacchetto 10 ore', quantity: 1, unitPrice: 250, vatRate: 22 },
      { description: 'Materiale didattico', quantity: 3, unitPrice: 15, vatRate: 4 },
      { description: 'Quota esente', quantity: 1, unitPrice: 80, vatRate: 0, vatNature: 'N4' },
    ]

    const res = await patchInvoice(
      jsonRequest(`${BASE}/${draftId}`, 'PATCH', { lines: NEW_LINES }),
      routeParams(draftId),
    )
    expect(res.status).toBe(200)
    const { invoice } = await res.json()

    const expected = computeInvoiceTotals(NEW_LINES)
    expect(invoice.lines).toHaveLength(3)
    expect(Number(invoice.subtotal)).toBe(expected.subtotal)
    expect(Number(invoice.vatTotal)).toBe(expected.vatTotal)
    expect(Number(invoice.total)).toBe(expected.total)
    expect(invoice.lines.map((l: { total: string }) => Number(l.total))).toEqual(
      expected.lineTotals,
    )

    // Sul DB: le vecchie righe sono state rimpiazzate, non accumulate.
    const dbLines = await prisma.invoiceLine.findMany({ where: { invoiceId: draftId } })
    expect(dbLines).toHaveLength(3)
  })

  it('PATCH lines[] su fattura ISSUED risponde 409 (immutabilità)', async () => {
    const res = await patchInvoice(
      jsonRequest(`${BASE}/${issuedInvoiceId}`, 'PATCH', {
        lines: [{ description: 'Tentativo', quantity: 1, unitPrice: 1, vatRate: 22 }],
      }),
      routeParams(issuedInvoiceId),
    )
    expect(res.status).toBe(409)
  })

  it('DELETE su fattura ISSUED risponde 409 (immutabilità fiscale)', async () => {
    const res = await deleteInvoice(
      jsonRequest(`${BASE}/${issuedInvoiceId}`, 'DELETE'),
      routeParams(issuedInvoiceId),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/nota di credito/i)

    // La fattura è ancora lì, intatta.
    const still = await prisma.invoice.findUnique({ where: { id: issuedInvoiceId } })
    expect(still?.status).toBe('ISSUED')
  })
})
