/**
 * Test PUT/DELETE /api/attendance/[id] (Wave 2):
 * - PUT: TEACHER titolare della lezione del record → 200
 * - PUT: TEACHER di un'altra lezione → 403 (mai update)
 * - PUT: TEACHER senza profilo → 403
 * - DELETE: ADMIN → 200; SECRETARY → 403 (fuori allow-list delete)
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  checkTenantAccess: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    teacher: { findFirst: jest.fn() },
    attendance: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}))

import { PUT, DELETE } from '@/app/api/attendance/[id]/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest(body: any = {}) {
  return {
    url: 'http://localhost:3000/api/attendance/att-1',
    headers: { get: () => null },
    json: async () => body,
  } as any
}

const routeParams = { params: Promise.resolve({ id: 'att-1' }) }

function sessionFor(role: string) {
  return {
    user: {
      id: `user-${role.toLowerCase()}`,
      tenantId: 'tenant-1',
      role,
      email: `${role.toLowerCase()}@test.local`,
    },
  }
}

const baseRecord = {
  id: 'att-1',
  status: 'PRESENT',
  notes: null,
  lesson: { id: 'lesson-1', teacherId: 'teacher-1', tenantId: 'tenant-1' },
}

describe('PUT /api/attendance/[id] — ownership docente', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.attendance.update.mockResolvedValue({
      ...baseRecord,
      status: 'ABSENT',
      student: { id: 's1', firstName: 'Marco', lastName: 'Rossi', email: 'm@r.it' },
    })
  })

  it('TEACHER titolare della lezione → 200', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
    prisma.attendance.findFirst.mockResolvedValue(baseRecord)

    const res = await PUT(createRequest({ status: 'ABSENT' }), routeParams)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ABSENT')
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-1' },
        data: expect.objectContaining({ status: 'ABSENT' }),
      })
    )
    // scoping tenant via lesson (Attendance non ha tenantId)
    expect(prisma.attendance.findFirst.mock.calls[0][0].where.lesson).toEqual({
      tenantId: 'tenant-1',
    })
  })

  it('TEACHER di un altro docente → 403 e nessun update', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-ALTRO' })
    prisma.attendance.findFirst.mockResolvedValue(baseRecord)

    const res = await PUT(createRequest({ status: 'ABSENT' }), routeParams)
    expect(res.status).toBe(403)
    expect(prisma.attendance.update).not.toHaveBeenCalled()
  })

  it('TEACHER senza profilo risolvibile → 403', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue(null)
    prisma.attendance.findFirst.mockResolvedValue(baseRecord)

    const res = await PUT(createRequest({ status: 'ABSENT' }), routeParams)
    expect(res.status).toBe(403)
    expect(prisma.attendance.update).not.toHaveBeenCalled()
  })

  it('status non valido → 400', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))
    prisma.attendance.findFirst.mockResolvedValue(baseRecord)

    const res = await PUT(createRequest({ status: 'INVENTATO' }), routeParams)
    expect(res.status).toBe(400)
    expect(prisma.attendance.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/attendance/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.attendance.delete.mockResolvedValue({})
  })

  it('ADMIN → 200', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))
    prisma.attendance.findFirst.mockResolvedValue(baseRecord)

    const res = await DELETE(createRequest(), routeParams)
    expect(res.status).toBe(200)
    expect(prisma.attendance.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } })
  })

  it('SECRETARY → 403 (fuori allow-list delete)', async () => {
    getAuth.mockResolvedValue(sessionFor('SECRETARY'))

    const res = await DELETE(createRequest(), routeParams)
    expect(res.status).toBe(403)
    expect(prisma.attendance.delete).not.toHaveBeenCalled()
  })
})
