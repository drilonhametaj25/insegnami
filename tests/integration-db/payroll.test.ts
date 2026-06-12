/**
 * Integration-DB: ciclo payroll completo contro Postgres reale.
 * periodo → generate (ore da lezioni COMPLETED) → approve → mark-paid
 * (con AccountingMovement COST idempotente).
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
import { POST as createPeriod } from '@/app/api/payroll/periods/route'
import { POST as generatePayrolls } from '@/app/api/payroll/periods/[id]/generate/route'
import { POST as approvePayroll } from '@/app/api/payroll/[id]/approve/route'
import { POST as markPaidPayroll } from '@/app/api/payroll/[id]/mark-paid/route'
import {
  createTenantFixture,
  buildAdminSession,
  TEACHER_HOURLY_RATE,
  TOTAL_LESSON_HOURS,
  type TenantFixture,
} from './helpers/fixtures'

const mockedGetAuth = getAuth as jest.Mock

const BASE = 'http://localhost:3000/api/payroll'

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

describe('API payroll (integration-DB)', () => {
  let fixture: TenantFixture
  let periodId: string
  let payrollId: string

  beforeAll(async () => {
    fixture = await createTenantFixture(prisma)
  })

  afterAll(async () => {
    await fixture?.destroy()
  })

  beforeEach(() => {
    mockedGetAuth.mockResolvedValue(buildAdminSession(fixture))
  })

  it('POST periods crea il periodo {year, month} in stato OPEN', async () => {
    const res = await createPeriod(
      jsonRequest(`${BASE}/periods`, 'POST', {
        year: fixture.periodYear,
        month: fixture.periodMonth,
      }),
    )
    expect(res.status).toBe(201)
    const { period } = await res.json()
    expect(period.year).toBe(fixture.periodYear)
    expect(period.month).toBe(fixture.periodMonth)
    expect(period.status).toBe('OPEN')
    expect(period.tenantId).toBe(fixture.tenantId)
    periodId = period.id
  })

  it('POST generate crea il cedolino del teacher con grossBase = ore COMPLETED × rate', async () => {
    const res = await generatePayrolls(
      jsonRequest(`${BASE}/periods/${periodId}/generate`, 'POST'),
      routeParams(periodId),
    )
    expect(res.status).toBe(200)
    const result = await res.json()
    expect(result.generated).toBe(1) // un solo teacher attivo nella fixture
    expect(result.errors).toEqual([])

    const payroll = await prisma.payroll.findFirst({
      where: { periodId, teacherId: fixture.teacherId },
      include: { lineItems: true },
    })
    expect(payroll).not.toBeNull()
    expect(payroll!.status).toBe('DRAFT')
    // 2 lezioni COMPLETED del mese: 2h + 1.5h = 3.5h.
    expect(Number(payroll!.hoursWorked)).toBe(TOTAL_LESSON_HOURS)
    expect(Number(payroll!.hourlyRateSnapshot)).toBe(TEACHER_HOURLY_RATE)
    expect(Number(payroll!.grossBase)).toBe(TOTAL_LESSON_HOURS * TEACHER_HOURLY_RATE)
    // Nessuna ritenuta di default nella fixture → netto = lordo.
    expect(Number(payroll!.netAmount)).toBe(TOTAL_LESSON_HOURS * TEACHER_HOURLY_RATE)
    // Una riga HOURS per ogni lezione COMPLETED.
    expect(payroll!.lineItems.filter((l) => l.type === 'HOURS')).toHaveLength(2)
    payrollId = payroll!.id
  })

  it('POST approve porta il cedolino DRAFT → APPROVED', async () => {
    const res = await approvePayroll(
      jsonRequest(`${BASE}/${payrollId}/approve`, 'POST'),
      routeParams(payrollId),
    )
    expect(res.status).toBe(200)
    const { payroll } = await res.json()
    expect(payroll.status).toBe('APPROVED')
    expect(payroll.approvedBy).toBe(fixture.adminUser.id)
  })

  it('POST mark-paid crea il movimento contabile COST ed è idempotente', async () => {
    const res = await markPaidPayroll(
      jsonRequest(`${BASE}/${payrollId}/mark-paid`, 'POST'),
      routeParams(payrollId),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.payroll.status).toBe('PAID')
    expect(body.movementId).toBeTruthy()

    // Verifica della riga AccountingMovement generata.
    const movement = await prisma.accountingMovement.findFirst({
      where: { payrollId },
    })
    expect(movement).not.toBeNull()
    expect(movement!.id).toBe(body.movementId)
    expect(movement!.tenantId).toBe(fixture.tenantId)
    expect(movement!.type).toBe('COST')
    expect(movement!.source).toBe('PAYROLL')
    expect(movement!.category).toBe('stipendi')
    expect(Number(movement!.amount)).toBe(TOTAL_LESSON_HOURS * TEACHER_HOURLY_RATE)

    // Secondo mark-paid: il cedolino non è più APPROVED → 409 coerente,
    // e NON deve comparire un secondo movimento.
    const res2 = await markPaidPayroll(
      jsonRequest(`${BASE}/${payrollId}/mark-paid`, 'POST'),
      routeParams(payrollId),
    )
    expect(res2.status).toBe(409)

    const count = await prisma.accountingMovement.count({ where: { payrollId } })
    expect(count).toBe(1)
  })
})
