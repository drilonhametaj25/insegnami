/**
 * Test GET /api/attendance/summary/class/[id] (Wave 2):
 * - TEACHER titolare → 200 con shape attesa dalla pagina presenze
 * - TEACHER non titolare → 403
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
    class: { findFirst: jest.fn() },
    lesson: { count: jest.fn() },
    attendance: { findMany: jest.fn() },
  },
}))

import { GET } from '@/app/api/attendance/summary/class/[id]/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest(qs = '?timeframe=month') {
  return {
    url: `http://localhost:3000/api/attendance/summary/class/class-1${qs}`,
    headers: { get: () => null },
  } as any
}

const routeParams = { params: Promise.resolve({ id: 'class-1' }) }

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

const baseClass = {
  id: 'class-1',
  tenantId: 'tenant-1',
  teacherId: 'teacher-1',
  name: '1A',
  students: [
    {
      student: {
        id: 'stu-1',
        firstName: 'Marco',
        lastName: 'Rossi',
        email: 'marco@test.it',
        studentCode: 'S0001',
      },
    },
    {
      student: {
        id: 'stu-2',
        firstName: 'Anna',
        lastName: 'Verdi',
        email: 'anna@test.it',
        studentCode: 'S0002',
      },
    },
  ],
}

describe('GET /api/attendance/summary/class/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('TEACHER titolare → 200 con la shape attesa dalla pagina', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
    prisma.class.findFirst.mockResolvedValue(baseClass)
    prisma.lesson.count.mockResolvedValue(10)
    prisma.attendance.findMany.mockResolvedValue([
      { studentId: 'stu-1', status: 'PRESENT' },
      { studentId: 'stu-1', status: 'PRESENT' },
      { studentId: 'stu-1', status: 'LATE' },
      { studentId: 'stu-1', status: 'ABSENT' },
      { studentId: 'stu-2', status: 'ABSENT' },
    ])

    const res = await GET(createRequest(), routeParams)
    expect(res.status).toBe(200)

    const body = await res.json()
    // Shape esatta consumata da app/[locale]/dashboard/attendance/page.tsx
    expect(body.class.name).toBe('1A')
    expect(body.totalStudents).toBe(2)
    expect(body.totalLessons).toBe(10)
    expect(typeof body.averageAttendanceRate).toBe('number')

    const marco = body.studentSummaries.find((s: any) => s.studentId === 'stu-1')
    expect(marco.student.firstName).toBe('Marco')
    expect(marco.student.registrationNumber).toBe('S0001')
    expect(marco.presentCount).toBe(2)
    expect(marco.absentCount).toBe(1)
    expect(marco.lateCount).toBe(1)
    // (2 presenti + 1 ritardo) su 10 lezioni = 30%
    expect(marco.attendanceRate).toBeCloseTo(30)

    const anna = body.studentSummaries.find((s: any) => s.studentId === 'stu-2')
    expect(anna.presentCount).toBe(0)
    expect(anna.absentCount).toBe(1)
    expect(anna.attendanceRate).toBe(0)
  })

  it('TEACHER non titolare della classe → 403', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-ALTRO' })
    prisma.class.findFirst.mockResolvedValue(baseClass)

    const res = await GET(createRequest(), routeParams)
    expect(res.status).toBe(403)
  })

  it('STUDENT → 403 (fuori allow-list)', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT'))

    const res = await GET(createRequest(), routeParams)
    expect(res.status).toBe(403)
  })

  it('ADMIN su classe inesistente → 404', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))
    prisma.class.findFirst.mockResolvedValue(null)

    const res = await GET(createRequest(), routeParams)
    expect(res.status).toBe(404)
  })
})
