/**
 * Anti-bypass limiti piano sull'attivazione bulk (exploit: importare
 * studenti/docenti INACTIVE e attivarli in blocco aggirando il check
 * della POST singola).
 *
 * Contratto:
 *  - action 'activate' oltre maxStudents/maxTeachers → 403 code 'plan-limit'
 *  - entro il limite (o limite null = illimitato) → updateMany eseguito
 *  - i target già ACTIVE non contano come nuovi posti
 *  - SUPERADMIN bypassa il check
 *
 * Pattern mock: vedi stripe-webhook.test.ts / crud.test.ts.
 */
import { POST as bulkStudents } from '@/app/api/students/bulk/route'
import { PUT as bulkTeachers } from '@/app/api/teachers/bulk/route'

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    student: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    teacher: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  },
}))

jest.mock('@/lib/billing/limits', () => ({
  getEffectiveLimits: jest.fn(),
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const { getEffectiveLimits } = require('@/lib/billing/limits')

const adminSession = {
  user: { id: 'user-admin', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}
const superadminSession = {
  user: { id: 'user-sa', email: 'sa@insegnami.pro', role: 'SUPERADMIN', tenantId: 'tenant-1' },
}

function createRequest(body: any) {
  return {
    json: () => Promise.resolve(body),
    headers: { get: jest.fn(() => null) },
  } as any
}

const limits = (overrides: Record<string, any> = {}) => ({
  maxStudents: 10,
  maxTeachers: 5,
  maxClasses: null,
  storageBytes: null,
  planSlug: 'starter',
  addonExtras: { students: 0, teachers: 0, classes: 0, storageGb: 0 },
  ...overrides,
})

describe('bulk activate — enforcement limiti piano', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue(adminSession)
    prisma.student.updateMany.mockResolvedValue({ count: 3 })
    prisma.teacher.updateMany.mockResolvedValue({ count: 3 })
  })

  describe('POST /api/students/bulk', () => {
    const inactiveStudents = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `s-${i}`, status: 'INACTIVE' }))

    it('activate oltre maxStudents → 403 code plan-limit senza updateMany', async () => {
      prisma.student.findMany.mockResolvedValue(inactiveStudents(3))
      prisma.student.count.mockResolvedValue(8) // 8 attivi + 3 da attivare > 10
      getEffectiveLimits.mockResolvedValue(limits())

      const res = await bulkStudents(
        createRequest({ action: 'activate', studentIds: ['s-0', 's-1', 's-2'] })
      )
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.code).toBe('plan-limit')
      expect(prisma.student.updateMany).not.toHaveBeenCalled()
    })

    it('activate entro il limite → updateMany eseguito', async () => {
      prisma.student.findMany.mockResolvedValue(inactiveStudents(2))
      prisma.student.count.mockResolvedValue(8) // 8 + 2 = 10 → esattamente al limite
      getEffectiveLimits.mockResolvedValue(limits())

      const res = await bulkStudents(
        createRequest({ action: 'activate', studentIds: ['s-0', 's-1'] })
      )

      expect(res.status).toBe(200)
      expect(prisma.student.updateMany).toHaveBeenCalled()
    })

    it('i target già ACTIVE non contano come nuovi posti', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's-0', status: 'ACTIVE' },
        { id: 's-1', status: 'ACTIVE' },
        { id: 's-2', status: 'INACTIVE' },
      ])
      prisma.student.count.mockResolvedValue(9) // 9 attivi + 1 nuovo = 10, ok
      getEffectiveLimits.mockResolvedValue(limits())

      const res = await bulkStudents(
        createRequest({ action: 'activate', studentIds: ['s-0', 's-1', 's-2'] })
      )

      expect(res.status).toBe(200)
      expect(prisma.student.updateMany).toHaveBeenCalled()
    })

    it('limite null (illimitato) → nessun blocco', async () => {
      prisma.student.findMany.mockResolvedValue(inactiveStudents(50))
      getEffectiveLimits.mockResolvedValue(limits({ maxStudents: null }))

      const res = await bulkStudents(
        createRequest({
          action: 'activate',
          studentIds: Array.from({ length: 50 }, (_, i) => `s-${i}`),
        })
      )

      expect(res.status).toBe(200)
      expect(prisma.student.count).not.toHaveBeenCalled()
      expect(prisma.student.updateMany).toHaveBeenCalled()
    })

    it('SUPERADMIN bypassa il check', async () => {
      getAuth.mockResolvedValue(superadminSession)
      prisma.student.findMany.mockResolvedValue(inactiveStudents(3))

      const res = await bulkStudents(
        createRequest({ action: 'activate', studentIds: ['s-0', 's-1', 's-2'] })
      )

      expect(res.status).toBe(200)
      expect(getEffectiveLimits).not.toHaveBeenCalled()
      expect(prisma.student.updateMany).toHaveBeenCalled()
    })

    it('deactivate non consulta i limiti', async () => {
      prisma.student.findMany.mockResolvedValue(inactiveStudents(3))

      const res = await bulkStudents(
        createRequest({ action: 'deactivate', studentIds: ['s-0', 's-1', 's-2'] })
      )

      expect(res.status).toBe(200)
      expect(getEffectiveLimits).not.toHaveBeenCalled()
    })
  })

  describe('PUT /api/teachers/bulk', () => {
    const inactiveTeachers = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `t-${i}`, status: 'INACTIVE' }))

    it('activate oltre maxTeachers → 403 code plan-limit senza updateMany', async () => {
      prisma.teacher.findMany.mockResolvedValue(inactiveTeachers(3))
      prisma.teacher.count.mockResolvedValue(4) // 4 attivi + 3 > 5
      getEffectiveLimits.mockResolvedValue(limits())

      const res = await bulkTeachers(
        createRequest({ action: 'activate', teacherIds: ['t-0', 't-1', 't-2'] })
      )
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.code).toBe('plan-limit')
      expect(prisma.teacher.updateMany).not.toHaveBeenCalled()
    })

    it('activate entro il limite → updateMany eseguito', async () => {
      prisma.teacher.findMany.mockResolvedValue(inactiveTeachers(1))
      prisma.teacher.count.mockResolvedValue(4) // 4 + 1 = 5, al limite
      getEffectiveLimits.mockResolvedValue(limits())

      const res = await bulkTeachers(createRequest({ action: 'activate', teacherIds: ['t-0'] }))

      expect(res.status).toBe(200)
      expect(prisma.teacher.updateMany).toHaveBeenCalled()
    })

    it('SUPERADMIN bypassa il check', async () => {
      getAuth.mockResolvedValue(superadminSession)
      prisma.teacher.findMany.mockResolvedValue(inactiveTeachers(3))

      const res = await bulkTeachers(
        createRequest({ action: 'activate', teacherIds: ['t-0', 't-1', 't-2'] })
      )

      expect(res.status).toBe(200)
      expect(getEffectiveLimits).not.toHaveBeenCalled()
      expect(prisma.teacher.updateMany).toHaveBeenCalled()
    })
  })
})
