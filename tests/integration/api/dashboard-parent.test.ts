/**
 * Wave 2 — Dashboard genitore (GET /api/dashboard/parent).
 *
 * Contratto:
 *  - PARENT → 200 { success, data } con children[] multi-figlio: unione di
 *    StudentGuardian (figlio-1) e fallback legacy parentUserId (figlio-2),
 *    ognuno con le proprie statistiche.
 *  - Nessun figlio → 200 con children[] vuoto (non 404).
 *  - Ruoli estranei → 403; non autenticato → 401.
 *
 * Pattern mock: vedi crud.test.ts / payment-receipt.test.ts.
 */
import { GET as getParentDashboard } from '@/app/api/dashboard/parent/route'

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
    studentGuardian: { findMany: jest.fn() },
    student: { findMany: jest.fn() },
    lesson: { findMany: jest.fn() },
    attendance: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
    notice: { findMany: jest.fn() },
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
      firstName: 'Paola',
      lastName: 'Rossi',
    },
  }
}

function makeRequest(url = '/api/dashboard/parent') {
  return { url: `http://localhost${url}`, method: 'GET' } as any
}

function childRecord(id: string, firstName: string) {
  return {
    id,
    studentCode: `S-${id}`,
    firstName,
    lastName: 'Rossi',
    email: null,
    phone: null,
    dateOfBirth: new Date('2012-05-05'),
    status: 'ACTIVE',
    enrollmentDate: new Date('2025-09-01'),
    user: {
      id: `user-${id}`,
      firstName,
      lastName: 'Rossi',
      email: `${id}@test.it`,
      phone: null,
    },
    classes: [
      {
        id: `sc-${id}`,
        studentId: id,
        classId: 'class-1',
        enrolledAt: new Date('2025-09-01'),
        class: {
          id: 'class-1',
          name: '1A Inglese',
          course: { id: 'course-1', name: 'Inglese' },
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
}

function primeHappyPath() {
  // figlio-1 via StudentGuardian, figlio-2 via fallback legacy parentUserId
  prisma.studentGuardian.findMany.mockResolvedValue([{ studentId: 'child-1' }])
  prisma.student.findMany.mockImplementation((args: any) => {
    if (args?.where?.parentUserId) {
      return Promise.resolve([{ id: 'child-2' }])
    }
    return Promise.resolve([
      childRecord('child-1', 'Aldo'),
      childRecord('child-2', 'Bea'),
    ])
  })
  prisma.lesson.findMany.mockResolvedValue([
    {
      id: 'less-1',
      title: 'Lezione futura',
      description: null,
      startTime: new Date('2026-09-08T10:00:00Z'),
      endTime: new Date('2026-09-08T11:00:00Z'),
      status: 'SCHEDULED',
      room: null,
      materials: null,
      teacher: { id: 'teach-1', firstName: 'Anna', lastName: 'Neri', email: 'anna@test.it' },
      class: {
        name: '1A Inglese',
        course: { id: 'course-1', name: 'Inglese' },
        students: [
          {
            studentId: 'child-1',
            student: { id: 'child-1', firstName: 'Aldo', lastName: 'Rossi' },
          },
        ],
      },
    },
  ])
  prisma.attendance.findMany.mockResolvedValue([
    {
      id: 'att-1',
      studentId: 'child-1',
      status: 'PRESENT',
      notes: null,
      createdAt: new Date('2026-09-01T11:00:00Z'),
      student: { id: 'child-1', firstName: 'Aldo', lastName: 'Rossi' },
      lesson: {
        id: 'less-0',
        title: 'Lezione 0',
        startTime: new Date('2026-09-01T10:00:00Z'),
        teacher: { id: 'teach-1', firstName: 'Anna', lastName: 'Neri' },
        class: { course: { name: 'Inglese' } },
      },
    },
    {
      id: 'att-2',
      studentId: 'child-2',
      status: 'ABSENT',
      notes: null,
      createdAt: new Date('2026-09-01T11:00:00Z'),
      student: { id: 'child-2', firstName: 'Bea', lastName: 'Rossi' },
      lesson: {
        id: 'less-0',
        title: 'Lezione 0',
        startTime: new Date('2026-09-01T10:00:00Z'),
        teacher: { id: 'teach-1', firstName: 'Anna', lastName: 'Neri' },
        class: { course: { name: 'Inglese' } },
      },
    },
  ])
  prisma.payment.findMany.mockResolvedValue([
    {
      id: 'pay-1',
      studentId: 'child-1',
      amount: 150,
      description: 'Retta settembre',
      dueDate: new Date('2026-09-30T00:00:00Z'),
      status: 'PENDING',
      paidDate: null,
      student: { id: 'child-1', firstName: 'Aldo', lastName: 'Rossi' },
    },
  ])
  prisma.notice.findMany.mockResolvedValue([])
}

beforeEach(() => {
  jest.clearAllMocks()
  const { getTenantAccessCached } = require('@/lib/tenant-access')
  getTenantAccessCached.mockResolvedValue({ ok: true })
})

describe('GET /api/dashboard/parent — autorizzazione', () => {
  it('401 se non autenticato', async () => {
    getAuth.mockResolvedValue(null)
    const res = await getParentDashboard(makeRequest())
    expect(res.status).toBe(401)
  })

  it.each(['TEACHER', 'STUDENT', 'ADMIN', 'SECRETARY'])('403 per ruolo %s', async (role) => {
    getAuth.mockResolvedValue(sessionFor(role))
    const res = await getParentDashboard(makeRequest())
    expect(res.status).toBe(403)
  })
})

describe('GET /api/dashboard/parent — scoping guardian multi-figlio', () => {
  beforeEach(() => {
    getAuth.mockResolvedValue(sessionFor('PARENT', 'user-parent'))
    primeHappyPath()
  })

  it('unisce figli da StudentGuardian e fallback parentUserId', async () => {
    const res = await getParentDashboard(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.success).toBe(true)
    const childIds = body.data.children.map((c: any) => c.id)
    expect(childIds).toEqual(expect.arrayContaining(['child-1', 'child-2']))
    expect(body.data.stats.enrolledChildren).toBe(2)

    // Lookup guardian scoped per genitore + tenant
    const guardianCall = prisma.studentGuardian.findMany.mock.calls[0][0]
    expect(guardianCall.where).toMatchObject({
      userId: 'user-parent',
      tenantId: 'tenant-1',
    })

    // Fetch figli scoped su id risolti + tenant
    const childrenCall = prisma.student.findMany.mock.calls.find(
      (c: any[]) => c[0]?.where?.id?.in
    )?.[0]
    expect(childrenCall.where.tenantId).toBe('tenant-1')
    expect(childrenCall.where.id.in).toEqual(
      expect.arrayContaining(['child-1', 'child-2'])
    )
  })

  it('statistiche per figlio calcolate sui rispettivi dati', async () => {
    const res = await getParentDashboard(makeRequest())
    const body = await res.json()

    const aldo = body.data.children.find((c: any) => c.id === 'child-1')
    const bea = body.data.children.find((c: any) => c.id === 'child-2')

    expect(aldo.stats).toMatchObject({
      activeCourses: 1,
      attendanceRate: 100,
      totalLessons: 1,
      pendingPayments: 1,
    })
    expect(bea.stats).toMatchObject({
      activeCourses: 1,
      attendanceRate: 0,
      totalLessons: 1,
      pendingPayments: 0,
    })

    // nextLesson solo per il figlio iscritto alla classe della lezione
    expect(aldo.nextLesson).toMatchObject({ id: 'less-1', teacher: 'Anna Neri' })
    expect(bea.nextLesson).toBeNull()
  })

  it('payments con paidDate (non paidAt/type) e figlio associato', async () => {
    const res = await getParentDashboard(makeRequest())
    const body = await res.json()

    expect(body.data.payments[0]).toMatchObject({
      id: 'pay-1',
      status: 'PENDING',
      child: { id: 'child-1' },
    })
    expect(body.data.payments[0]).toHaveProperty('paidDate')
    expect(body.data.payments[0]).not.toHaveProperty('paidAt')
    expect(body.data.payments[0]).not.toHaveProperty('type')
  })

  it('scopa Attendance via lesson.tenantId e ordina su lesson.startTime', async () => {
    const res = await getParentDashboard(makeRequest())
    expect(res.status).toBe(200)

    const call = prisma.attendance.findMany.mock.calls[0][0]
    expect(call.where.tenantId).toBeUndefined()
    expect(call.where.lesson.tenantId).toBe('tenant-1')
    expect(call.where.studentId.in).toEqual(
      expect.arrayContaining(['child-1', 'child-2'])
    )
    expect(JSON.stringify(call.orderBy)).not.toContain('recordedAt')
  })

  it('genitore senza figli → 200 con children[] vuoto', async () => {
    prisma.studentGuardian.findMany.mockResolvedValue([])
    prisma.student.findMany.mockResolvedValue([])

    const res = await getParentDashboard(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.children).toEqual([])
    expect(body.data.stats.enrolledChildren).toBe(0)
  })
})
