/**
 * 3B1 — Generatore codici studente per-tenant (lib/user-profile-sync).
 *
 * Contratto:
 *  - POST /api/students usa generateStudentCode: la sequenza riparte per ogni
 *    tenant (@@unique([tenantId, studentCode])) → il PRIMO studente di due
 *    tenant diversi ottiene lo stesso codice e va a buon fine in entrambi (201).
 *  - Collisione residua (P2002) → 409 esplicito, non 500 generico.
 *
 * Pattern mock: vedi crud.test.ts.
 */
import { POST as postStudent } from '@/app/api/students/route'

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/plan-limits', () => ({
  checkStudentLimit: jest.fn(() => Promise.resolve({ allowed: true })),
}))

jest.mock('@/lib/api-middleware', () => ({
  getPublicErrorMessage: (_err: any, fallback: string) => fallback,
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    student: {
      count: jest.fn(),
      findUnique: jest.fn(), // lookup compound tenantId_studentCode del generatore
      create: jest.fn(),
    },
    studentGuardian: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userTenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function sessionFor(tenantId: string) {
  return {
    user: { id: `admin-${tenantId}`, email: `admin@${tenantId}.it`, role: 'ADMIN', tenantId },
  }
}

function createRequest(body: any) {
  return {
    url: 'http://localhost/api/students',
    method: 'POST',
    json: () => Promise.resolve(body),
  } as any
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.user.findUnique.mockResolvedValue(null)
  prisma.user.create.mockImplementation(async ({ data }: any) => ({ id: `u-${data.email}`, email: data.email }))
  prisma.student.count.mockResolvedValue(0) // primo studente in entrambi i tenant
  prisma.student.findUnique.mockResolvedValue(null) // nessuna collisione sul compound
  prisma.student.create.mockImplementation(async ({ data }: any) => ({
    id: `s-${data.tenantId}`,
    ...data,
    parentUser: null,
    user: null,
  }))
})

describe('POST /api/students — codici per-tenant senza collisioni cross-tenant', () => {
  it('il primo studente di due tenant diversi ottiene 201 in entrambi (stesso codice)', async () => {
    // Tenant 1
    getAuth.mockResolvedValue(sessionFor('tenant-1'))
    const res1 = await postStudent(createRequest({ firstName: 'Luca', lastName: 'Verdi' }))
    expect(res1.status).toBe(201)

    // Tenant 2 — stessa sequenza (count=0) ma tenant diverso
    getAuth.mockResolvedValue(sessionFor('tenant-2'))
    const res2 = await postStudent(createRequest({ firstName: 'Anna', lastName: 'Rossi' }))
    expect(res2.status).toBe(201)

    // Entrambe le create sono scoped sul proprio tenant, con lo stesso codice
    const createCalls = prisma.student.create.mock.calls.map((c: any[]) => c[0].data)
    expect(createCalls).toHaveLength(2)
    expect(createCalls[0].tenantId).toBe('tenant-1')
    expect(createCalls[1].tenantId).toBe('tenant-2')
    expect(createCalls[0].studentCode).toBe('S0001')
    expect(createCalls[1].studentCode).toBe('S0001')

    // Il generatore verifica il vincolo compound per-tenant, non globale
    expect(prisma.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_studentCode: { tenantId: 'tenant-1', studentCode: 'S0001' } },
      })
    )
    expect(prisma.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_studentCode: { tenantId: 'tenant-2', studentCode: 'S0001' } },
      })
    )
  })

  it('collisione sul codice base → il generatore ripiega su un suffisso random', async () => {
    getAuth.mockResolvedValue(sessionFor('tenant-1'))
    // 'S0001' già occupato (cancellazioni che fanno regredire il count),
    // il secondo candidato è libero
    prisma.student.findUnique
      .mockResolvedValueOnce({ id: 's-esistente' })
      .mockResolvedValueOnce(null)

    const res = await postStudent(createRequest({ firstName: 'Luca', lastName: 'Verdi' }))
    expect(res.status).toBe(201)

    const created = prisma.student.create.mock.calls[0][0].data
    expect(created.studentCode).toMatch(/^S0001-[A-Z2-9]{3}$/)
  })

  it('P2002 residuo sulla create → 409 esplicito', async () => {
    getAuth.mockResolvedValue(sessionFor('tenant-1'))
    prisma.student.create.mockRejectedValue({ code: 'P2002' })

    const res = await postStudent(createRequest({ firstName: 'Luca', lastName: 'Verdi' }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/conflitto/i)
  })
})
