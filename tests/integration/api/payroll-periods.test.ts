/**
 * TDD C3 — GET /api/payroll/periods con include leggero dei cedolini.
 *
 * Contratto:
 *  - La GET ritorna { periods } e ogni periodo include, oltre a _count.payrolls,
 *    anche payrolls[] in versione leggera (id, status, netAmount, grossBase,
 *    extrasTotal, teacher {id, firstName, lastName}) per popolare
 *    l'espansione in UI.
 *  - Per ADMIN i payrolls inclusi NON sono filtrati per docente.
 *  - Per TEACHER i payrolls inclusi sono filtrati sul proprio teacherId
 *    (risolto via getTeacherIdForUser); se l'utente non ha un Teacher
 *    associato il filtro è '__no_teacher__' (nessun cedolino).
 *  - I filtri year/status restano applicati al where dei periodi.
 *
 * Pattern mock: vedi delete-audit.test.ts (requireAuth + prisma mockati).
 */
import { GET as getPeriods } from '@/app/api/payroll/periods/route'

jest.mock('@/lib/api-auth', () => ({
  requireAuth: jest.fn(),
  authError: jest.fn(() => null),
  tenantScope: (ctx: any, base: any = {}) => ({ ...base, tenantId: ctx.tenantId }),
  getTeacherIdForUser: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    payrollPeriod: { findMany: jest.fn() },
  },
}))

const { requireAuth, getTeacherIdForUser } = require('@/lib/api-auth')
const { prisma } = require('@/lib/db')

const adminCtx = {
  userId: 'user-admin',
  tenantId: 'tenant-1',
  role: 'ADMIN',
  email: 'admin@scuola.it',
  isSuperAdmin: false,
}

const teacherCtx = {
  userId: 'user-teacher',
  tenantId: 'tenant-1',
  role: 'TEACHER',
  email: 'teacher@scuola.it',
  isSuperAdmin: false,
}

const periodRow = {
  id: 'period-1',
  tenantId: 'tenant-1',
  year: 2026,
  month: 6,
  status: 'OPEN',
  notes: null,
  _count: { payrolls: 1 },
  payrolls: [
    {
      id: 'payroll-1',
      status: 'DRAFT',
      netAmount: '800',
      grossBase: '900',
      extrasTotal: '100',
      teacher: { id: 'teacher-1', firstName: 'Mario', lastName: 'Rossi' },
    },
  ],
}

/** Request minimale: la route usa solo request.nextUrl.searchParams */
function createRequest(query = '') {
  return { nextUrl: new URL(`http://localhost/api/payroll/periods${query}`) } as any
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.payrollPeriod.findMany.mockResolvedValue([periodRow])
  getTeacherIdForUser.mockResolvedValue(null)
})

describe('GET /api/payroll/periods — include cedolini leggeri (C3)', () => {
  it('ADMIN: ritorna { periods } con payrolls inclusi senza filtro docente', async () => {
    requireAuth.mockResolvedValue(adminCtx)

    const res = await getPeriods(createRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.periods).toHaveLength(1)
    expect(body.periods[0].payrolls[0].teacher.firstName).toBe('Mario')

    const args = prisma.payrollPeriod.findMany.mock.calls[0][0]
    // _count conservato per retrocompatibilità
    expect(args.include._count).toEqual({ select: { payrolls: true } })
    // Include leggero: select esplicita con teacher e nessun where per ADMIN
    expect(args.include.payrolls.select).toEqual(
      expect.objectContaining({
        id: true,
        status: true,
        netAmount: true,
        grossBase: true,
        extrasTotal: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
      }),
    )
    expect(args.include.payrolls.where).toBeUndefined()
  })

  it('TEACHER: i payrolls inclusi sono filtrati sul proprio teacherId', async () => {
    requireAuth.mockResolvedValue(teacherCtx)
    getTeacherIdForUser.mockResolvedValue('teacher-1')

    const res = await getPeriods(createRequest())
    expect(res.status).toBe(200)

    const args = prisma.payrollPeriod.findMany.mock.calls[0][0]
    expect(args.include.payrolls.where).toEqual({ teacherId: 'teacher-1' })
  })

  it('TEACHER senza Teacher associato: filtro sentinella (nessun cedolino)', async () => {
    requireAuth.mockResolvedValue(teacherCtx)
    getTeacherIdForUser.mockResolvedValue(null)

    const res = await getPeriods(createRequest())
    expect(res.status).toBe(200)

    const args = prisma.payrollPeriod.findMany.mock.calls[0][0]
    expect(args.include.payrolls.where).toEqual({ teacherId: '__no_teacher__' })
  })

  it('applica i filtri year/status al where dei periodi', async () => {
    requireAuth.mockResolvedValue(adminCtx)

    const res = await getPeriods(createRequest('?year=2026&status=OPEN'))
    expect(res.status).toBe(200)

    const args = prisma.payrollPeriod.findMany.mock.calls[0][0]
    expect(args.where).toEqual(expect.objectContaining({ tenantId: 'tenant-1', year: 2026, status: 'OPEN' }))
  })
})
