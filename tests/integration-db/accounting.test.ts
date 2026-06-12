/**
 * Integration-DB: movimenti contabili e P&L contro Postgres reale.
 * COST manuale via API + REVENUE da Payment PAID (via syncPaymentMovement)
 * → il P&L del periodo riflette entrambi con totali corretti.
 */
jest.mock('@/lib/auth', () => ({
  __esModule: true,
  getAuth: jest.fn(),
  // Vedi invoices.test.ts: niente requireActual per non inizializzare NextAuth.
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
  isAdminRole: (role?: string) =>
    ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role ?? ''),
  canManage: (role?: string) =>
    ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'].includes(role ?? ''),
}))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { syncPaymentMovement } from '@/lib/accounting/movements'
import { POST as createMovement } from '@/app/api/accounting/movements/route'
import { GET as getPnlReport } from '@/app/api/accounting/pnl/route'
import {
  createTenantFixture,
  buildAdminSession,
  type TenantFixture,
} from './helpers/fixtures'

const mockedGetAuth = getAuth as jest.Mock

const BASE = 'http://localhost:3000/api/accounting'

const COST_AMOUNT = 100
const REVENUE_AMOUNT = 250

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] & { duplex?: 'half' } = {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body), duplex: 'half' as const } : {}),
  }
  return new NextRequest(url, init)
}

/** "YYYY-MM-DD" per un giorno del mese corrente della fixture. */
function isoDay(fixture: TenantFixture, day: number): string {
  const m = String(fixture.periodMonth).padStart(2, '0')
  return `${fixture.periodYear}-${m}-${String(day).padStart(2, '0')}`
}

describe('API accounting (integration-DB)', () => {
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

  it('POST movements crea un COST manuale con source MANUAL', async () => {
    const res = await createMovement(
      jsonRequest(`${BASE}/movements`, 'POST', {
        date: isoDay(fixture, 15),
        type: 'COST',
        category: 'marketing',
        amount: COST_AMOUNT,
        description: 'Campagna social (fixture)',
      }),
    )
    expect(res.status).toBe(201)
    const { movement } = await res.json()
    expect(movement.tenantId).toBe(fixture.tenantId)
    expect(movement.type).toBe('COST')
    expect(movement.source).toBe('MANUAL')
    expect(movement.category).toBe('marketing')
    expect(Number(movement.amount)).toBe(COST_AMOUNT)
    expect(movement.createdBy).toBe(fixture.adminUser.id)
  })

  it('GET pnl riflette REVENUE da Payment PAID e il COST manuale nel periodo', async () => {
    // REVENUE: Payment PAID creato via prisma + sync del movimento contabile
    // (stesso percorso usato dalle route /api/payments al flip di stato).
    const payment = await prisma.payment.create({
      data: {
        tenantId: fixture.tenantId,
        studentId: fixture.studentId,
        classId: fixture.classId,
        description: 'Retta mese corrente (fixture)',
        amount: REVENUE_AMOUNT,
        status: 'PAID',
        dueDate: new Date(`${isoDay(fixture, 1)}T00:00:00.000Z`),
        paidDate: new Date(`${isoDay(fixture, 8)}T00:00:00.000Z`),
      },
    })
    const sync = await syncPaymentMovement(prisma, payment.id, {
      createdBy: fixture.adminUser.id,
    })
    expect(sync.reason).toBe('created')
    expect(sync.movementId).toBeTruthy()

    // Idempotenza dell'helper: il secondo sync NON duplica il movimento.
    const sync2 = await syncPaymentMovement(prisma, payment.id)
    expect(sync2.reason).toBe('already-exists')
    expect(sync2.movementId).toBe(sync.movementId)

    // P&L del mese corrente: REVENUE 250 (rette) − COST 100 (marketing).
    const lastDay = new Date(
      Date.UTC(fixture.periodYear, fixture.periodMonth, 0),
    ).getUTCDate()
    const res = await getPnlReport(
      new NextRequest(
        `${BASE}/pnl?from=${isoDay(fixture, 1)}&to=${isoDay(fixture, lastDay)}`,
      ),
    )
    expect(res.status).toBe(200)
    const { report } = await res.json()

    expect(report.revenueTotal).toBe(REVENUE_AMOUNT)
    expect(report.costTotal).toBe(COST_AMOUNT)
    expect(report.netMargin).toBe(REVENUE_AMOUNT - COST_AMOUNT)
    expect(report.marginPct).toBe(
      Math.round(((REVENUE_AMOUNT - COST_AMOUNT) / REVENUE_AMOUNT) * 100 * 100) / 100,
    )
    expect(report.movementCount).toBe(2)
    expect(report.revenues).toEqual([
      { category: 'rette', total: REVENUE_AMOUNT, count: 1 },
    ])
    expect(report.costs).toEqual([
      { category: 'marketing', total: COST_AMOUNT, count: 1 },
    ])
  })
})
