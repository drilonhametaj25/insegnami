/**
 * Test GET /api/dashboard/teacher (Wave 2 — vista docente):
 * - TEACHER con profilo risolvibile → 200 e query filtrate sul proprio teacherId
 * - TEACHER senza profilo Teacher → 403 (mai dati di altri)
 * - STUDENT → 403 (fuori allow-list)
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
    lesson: { findMany: jest.fn(), count: jest.fn() },
    homework: { findMany: jest.fn() },
  },
}))

import { GET } from '@/app/api/dashboard/teacher/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest() {
  return {
    url: 'http://localhost:3000/api/dashboard/teacher',
    method: 'GET',
    headers: { get: () => null },
  } as any
}

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

describe('GET /api/dashboard/teacher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.lesson.findMany.mockResolvedValue([])
    prisma.lesson.count.mockResolvedValue(0)
    prisma.homework.findMany.mockResolvedValue([])
  })

  it('TEACHER con profilo → 200 con lezioni proprie (where.teacherId)', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })

    const todayLesson = {
      id: 'lesson-1',
      title: 'Matematica',
      class: { id: 'c1', name: '1A' },
      _count: { attendance: 3 },
    }
    prisma.lesson.findMany
      .mockResolvedValueOnce([todayLesson]) // todayLessons
      .mockResolvedValueOnce([]) // pendingAttendance
    prisma.lesson.count.mockResolvedValue(5)

    const res = await GET(createRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.todayLessons).toHaveLength(1)
    expect(body.data.todayLessons[0].class.name).toBe('1A')
    expect(body.data.weekLessonsCount).toBe(5)
    expect(body.data).toHaveProperty('pendingAttendance')
    expect(body.data).toHaveProperty('upcomingHomework')

    // Ogni query lezioni DEVE essere vincolata al teacherId risolto + tenant
    for (const call of prisma.lesson.findMany.mock.calls) {
      expect(call[0].where.teacherId).toBe('teacher-1')
      expect(call[0].where.tenantId).toBe('tenant-1')
    }
    expect(prisma.lesson.count.mock.calls[0][0].where.teacherId).toBe('teacher-1')
    expect(prisma.homework.findMany.mock.calls[0][0].where.teacherId).toBe('teacher-1')
  })

  it('la lista pendingAttendance filtra le lezioni senza record Attendance', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })

    const res = await GET(createRequest())
    expect(res.status).toBe(200)

    // seconda findMany = pendingAttendance: attendance none + status non CANCELLED
    const pendingCall = prisma.lesson.findMany.mock.calls[1][0]
    expect(pendingCall.where.attendance).toEqual({ none: {} })
    expect(pendingCall.where.status).toEqual({ not: 'CANCELLED' })
  })

  it('TEACHER senza profilo Teacher → 403', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    // né lookup per userId né fallback email risolvono
    prisma.teacher.findFirst.mockResolvedValue(null)

    const res = await GET(createRequest())
    expect(res.status).toBe(403)
    expect(prisma.lesson.findMany).not.toHaveBeenCalled()
  })

  it('STUDENT → 403 (fuori allow-list)', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT'))

    const res = await GET(createRequest())
    expect(res.status).toBe(403)
  })
})
