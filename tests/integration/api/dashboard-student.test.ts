/**
 * Wave 2 — Dashboard studente (GET /api/dashboard/student).
 *
 * Contratto:
 *  - STUDENT con profilo risolvibile → 200 { success, data } con shape reale:
 *    payments con paidDate (non paidAt/type), hoursPackages con
 *    totalHours/remainingHours, attendance scoped via lesson (niente tenantId
 *    diretto su Attendance).
 *  - STUDENT senza profilo Student → 404.
 *  - Ruoli estranei → 403; non autenticato → 401.
 *
 * Pattern mock: vedi crud.test.ts / payment-receipt.test.ts.
 */
import { GET as getStudentDashboard } from '@/app/api/dashboard/student/route'

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  checkTenantAccess: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
    lesson: { findMany: jest.fn(), groupBy: jest.fn() },
    attendance: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
    notice: { findMany: jest.fn() },
    homework: { findMany: jest.fn() },
    hoursPackage: { findMany: jest.fn() },
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function sessionFor(role: string, id = `user-${role.toLowerCase()}`) {
  return {
    user: {
      id,
      tenantId: 'tenant-1',
      role,
      email: `${role.toLowerCase()}@test.local`,
      firstName: 'Test',
      lastName: role,
    },
  }
}

function makeRequest(url = '/api/dashboard/student') {
  return { url: `http://localhost${url}`, method: 'GET' } as any
}

const studentRecord = {
  id: 'stud-1',
  studentCode: 'S001',
  firstName: 'Marco',
  lastName: 'Bianchi',
  email: 'marco@test.it',
  phone: null,
  dateOfBirth: new Date('2010-01-01'),
  status: 'ACTIVE',
  enrollmentDate: new Date('2025-09-01'),
  user: {
    id: 'user-student',
    firstName: 'Marco',
    lastName: 'Bianchi',
    email: 'marco@test.it',
    phone: null,
  },
  parentUser: null,
  classes: [
    {
      id: 'sc-1',
      studentId: 'stud-1',
      classId: 'class-1',
      enrolledAt: new Date('2025-09-01'),
      class: {
        id: 'class-1',
        name: '1A Inglese',
        course: { id: 'course-1', name: 'Inglese', level: 'A1' },
        teacher: {
          id: 'teach-1',
          firstName: 'Anna',
          lastName: 'Neri',
          email: 'anna@test.it',
        },
      },
    },
  ],
}

const attendanceRecord = {
  id: 'att-1',
  status: 'PRESENT',
  notes: null,
  createdAt: new Date('2026-09-01T11:00:00Z'),
  lesson: {
    id: 'less-1',
    classId: 'class-1',
    title: 'Lezione 1',
    startTime: new Date('2026-09-01T10:00:00Z'),
    teacher: { id: 'teach-1', firstName: 'Anna', lastName: 'Neri' },
    class: { course: { name: 'Inglese' } },
  },
}

function primeHappyPath() {
  prisma.student.findFirst.mockResolvedValue(studentRecord)
  prisma.lesson.findMany.mockResolvedValue([
    {
      id: 'less-2',
      title: 'Lezione futura',
      description: null,
      startTime: new Date('2026-09-08T10:00:00Z'),
      endTime: new Date('2026-09-08T11:00:00Z'),
      status: 'SCHEDULED',
      room: 'Aula 1',
      materials: null,
      teacher: { id: 'teach-1', firstName: 'Anna', lastName: 'Neri', email: 'anna@test.it' },
      class: { name: '1A Inglese', course: { id: 'course-1', name: 'Inglese' } },
    },
  ])
  prisma.lesson.groupBy.mockResolvedValue([{ classId: 'class-1', _count: { id: 10 } }])
  prisma.attendance.findMany.mockResolvedValue([attendanceRecord])
  prisma.payment.findMany.mockResolvedValue([
    {
      id: 'pay-1',
      amount: 150,
      description: 'Retta settembre',
      dueDate: new Date('2026-09-30T00:00:00Z'),
      status: 'PENDING',
      paidDate: null,
    },
  ])
  prisma.notice.findMany.mockResolvedValue([
    {
      id: 'not-1',
      title: 'Avviso',
      content: 'Contenuto',
      publishAt: new Date('2026-09-01T00:00:00Z'),
      isUrgent: false,
      isPinned: false,
      targetRoles: ['STUDENT'],
    },
  ])
  prisma.homework.findMany.mockResolvedValue([
    {
      id: 'hw-1',
      title: 'Compito 1',
      description: 'Esercizi',
      dueDate: new Date('2026-09-10T00:00:00Z'),
      assignedDate: new Date('2026-09-03T00:00:00Z'),
      subject: { id: 'sub-1', name: 'Grammatica' },
      class: { id: 'class-1', name: '1A Inglese', course: { name: 'Inglese' } },
      submissions: [],
    },
  ])
  prisma.hoursPackage.findMany.mockResolvedValue([
    {
      id: 'pkg-1',
      totalHours: 10,
      remainingHours: 4,
      expiryDate: null,
      isActive: true,
      purchaseDate: new Date('2026-08-01T00:00:00Z'),
      createdAt: new Date('2026-08-01T00:00:00Z'),
      course: { id: 'course-1', name: 'Inglese', level: 'A1' },
    },
  ])
}

beforeEach(() => {
  jest.clearAllMocks()
  const { getTenantAccessCached } = require('@/lib/tenant-access')
  getTenantAccessCached.mockResolvedValue({ ok: true })
})

describe('GET /api/dashboard/student — autorizzazione', () => {
  it('401 se non autenticato', async () => {
    getAuth.mockResolvedValue(null)
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(401)
  })

  it.each(['TEACHER', 'PARENT', 'ADMIN', 'SECRETARY'])('403 per ruolo %s', async (role) => {
    getAuth.mockResolvedValue(sessionFor(role))
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(403)
  })

  it('404 se il profilo Student non risolve', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT', 'user-student'))
    prisma.student.findFirst.mockResolvedValue(null)
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/studente/i)
  })
})

describe('GET /api/dashboard/student — shape e scoping', () => {
  beforeEach(() => {
    getAuth.mockResolvedValue(sessionFor('STUDENT', 'user-student'))
    primeHappyPath()
  })

  it('risolve lo studente via userId + tenantId', async () => {
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(200)

    const call = prisma.student.findFirst.mock.calls[0][0]
    expect(call.where).toMatchObject({
      userId: 'user-student',
      tenantId: 'tenant-1',
    })
  })

  it('200 con shape reale: stats, classes, payments con paidDate, hoursPackages', async () => {
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.student.id).toBe('stud-1')
    expect(body.data.stats).toMatchObject({
      activeCourses: 1,
      attendanceRate: 100,
      upcomingLessons: 1,
      pendingPayments: 1,
    })
    expect(body.data.classes[0]).toMatchObject({
      id: 'class-1',
      teacher: { name: 'Anna Neri' },
      totalLessons: 10,
      attendedLessons: 1,
      progress: 10,
    })

    // Campi reali di Payment: paidDate, niente paidAt/type
    expect(body.data.payments[0]).toMatchObject({ id: 'pay-1', status: 'PENDING' })
    expect(body.data.payments[0]).toHaveProperty('paidDate')
    expect(body.data.payments[0]).not.toHaveProperty('paidAt')
    expect(body.data.payments[0]).not.toHaveProperty('type')

    // Campi reali di HoursPackage
    expect(body.data.hoursPackages[0]).toMatchObject({
      totalHours: 10,
      remainingHours: 4,
      usedHours: 6,
      usedPercentage: 60,
      isLow: false,
      isActive: true,
    })
    expect(body.data.hoursPackages[0]).not.toHaveProperty('status')
    expect(body.data.hoursPackages[0]).not.toHaveProperty('expiresAt')
  })

  it('scopa Attendance via lesson.tenantId (Attendance non ha tenantId)', async () => {
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(200)

    const firstCall = prisma.attendance.findMany.mock.calls[0][0]
    expect(firstCall.where.tenantId).toBeUndefined()
    expect(firstCall.where.studentId).toBe('stud-1')
    expect(firstCall.where.lesson.tenantId).toBe('tenant-1')
    expect(firstCall.where.lesson.startTime.gte).toBeInstanceOf(Date)
    // Nessun orderBy su recordedAt (campo inesistente)
    expect(JSON.stringify(firstCall.orderBy)).not.toContain('recordedAt')
  })

  it('filtra i notices su publishAt/expiresAt e targetRoles STUDENT', async () => {
    const res = await getStudentDashboard(makeRequest())
    expect(res.status).toBe(200)

    const call = prisma.notice.findMany.mock.calls[0][0]
    expect(call.where.targetRoles).toEqual({ has: 'STUDENT' })
    expect(call.where.publishAt.lte).toBeInstanceOf(Date)
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        { expiresAt: null },
        { expiresAt: { gt: expect.any(Date) } },
      ])
    )
  })
})
