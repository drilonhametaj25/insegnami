/**
 * Wave 2 — Portale famiglia (perimetro C):
 * (a) GET /api/parent-meetings/my-options: 200 per PARENT con figli
 *     (guardian + fallback parentUserId) e docenti delle loro classi (dedup)
 * (b) my-options: 403 per TEACHER
 * (c) my-options: 200 per STUDENT read-only (children = proprio profilo)
 * (d) GET /api/parent-meetings: filtro figli guardian-aware (pattern OR)
 */
import { GET as getMyOptions } from '@/app/api/parent-meetings/my-options/route'
import { GET as getParentMeetings } from '@/app/api/parent-meetings/route'

// Mock auth (stesso pattern di materials-scoping.test.ts)
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Enforcement stato tenant: sempre ok (testato altrove)
jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  checkTenantAccess: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    student: { findMany: jest.fn(), findFirst: jest.fn() },
    studentGuardian: { findMany: jest.fn(), findFirst: jest.fn() },
    class: { findMany: jest.fn() },
    teacher: { findFirst: jest.fn() },
    parentMeeting: { findMany: jest.fn(), count: jest.fn() },
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

const parentSession = {
  user: { id: 'parent-1', email: 'genitore@scuola.it', role: 'PARENT', tenantId: 'tenant-1' },
}
const teacherSession = {
  user: { id: 'user-t', email: 'docente@scuola.it', role: 'TEACHER', tenantId: 'tenant-1' },
}
const studentSession = {
  user: { id: 'user-s', email: 'studente@scuola.it', role: 'STUDENT', tenantId: 'tenant-1' },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/parent-meetings/my-options', () => {
  it('(a) 200 per PARENT: figli via guardian/parentUserId e docenti dedup', async () => {
    getAuth.mockResolvedValue(parentSession)

    // getChildStudentIds: link guardian → s1, s2; legacy parentUserId → s1 (dedup)
    prisma.studentGuardian.findMany.mockResolvedValue([
      { studentId: 's1' },
      { studentId: 's2' },
    ])
    prisma.student.findMany.mockImplementation(({ where }: any) => {
      if (where?.parentUserId) {
        // Fallback legacy dentro getChildStudentIds
        return Promise.resolve([{ id: 's1' }])
      }
      // Dettagli figli per la risposta
      return Promise.resolve([
        { id: 's1', firstName: 'Anna', lastName: 'Bianchi' },
        { id: 's2', firstName: 'Luca', lastName: 'Bianchi' },
      ])
    })

    // Classi dei figli: t1 appare due volte (dedup atteso), t2 una volta
    prisma.class.findMany.mockResolvedValue([
      {
        teacherId: 't1',
        teacher: { id: 't1', firstName: 'Mario', lastName: 'Rossi' },
        classSubjects: [{ teacherId: 't1', subject: { name: 'Matematica' } }],
      },
      {
        teacherId: 't1',
        teacher: { id: 't1', firstName: 'Mario', lastName: 'Rossi' },
        classSubjects: [],
      },
      {
        teacherId: 't2',
        teacher: { id: 't2', firstName: 'Elena', lastName: 'Verdi' },
        // Materia insegnata da un altro docente: non va attribuita a t2
        classSubjects: [{ teacherId: 'altro', subject: { name: 'Inglese' } }],
      },
    ])

    const response = await getMyOptions()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.children).toHaveLength(2)
    expect(body.children.map((c: any) => c.id)).toEqual(['s1', 's2'])

    // Dedup: t1 una sola volta, con la propria materia
    expect(body.teachers).toHaveLength(2)
    const t1 = body.teachers.find((t: any) => t.id === 't1')
    const t2 = body.teachers.find((t: any) => t.id === 't2')
    expect(t1).toMatchObject({ firstName: 'Mario', lastName: 'Rossi', subjects: ['Matematica'] })
    expect(t2.subjects).toEqual([])

    // Le classi devono essere scoped su tenant e figli
    expect(prisma.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          students: {
            some: expect.objectContaining({
              studentId: { in: expect.arrayContaining(['s1', 's2']) },
            }),
          },
        }),
      })
    )
  })

  it('(b) 403 per TEACHER', async () => {
    getAuth.mockResolvedValue(teacherSession)

    const response = await getMyOptions()
    expect(response.status).toBe(403)
    expect(prisma.class.findMany).not.toHaveBeenCalled()
  })

  it('(c) 200 per STUDENT read-only: children contiene il proprio profilo', async () => {
    getAuth.mockResolvedValue(studentSession)

    prisma.student.findFirst.mockResolvedValue({
      id: 's9',
      firstName: 'Giulia',
      lastName: 'Neri',
    })
    prisma.class.findMany.mockResolvedValue([
      {
        teacherId: 't1',
        teacher: { id: 't1', firstName: 'Mario', lastName: 'Rossi' },
        classSubjects: [],
      },
    ])

    const response = await getMyOptions()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.children).toEqual([{ id: 's9', firstName: 'Giulia', lastName: 'Neri' }])
    expect(body.teachers.map((t: any) => t.id)).toEqual(['t1'])
  })

  it('(a-bis) PARENT senza figli: 200 con liste vuote, nessuna query classi', async () => {
    getAuth.mockResolvedValue(parentSession)
    prisma.studentGuardian.findMany.mockResolvedValue([])
    prisma.student.findMany.mockResolvedValue([])

    const response = await getMyOptions()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({ children: [], teachers: [] })
    expect(prisma.class.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/parent-meetings - filtro figli guardian-aware', () => {
  function createRequest(url = 'http://localhost:3000/api/parent-meetings') {
    return { url } as any
  }

  it('(d) PARENT: lookup figli con OR parentUserId/guardians e where scoped sui figli', async () => {
    getAuth.mockResolvedValue(parentSession)

    prisma.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    prisma.parentMeeting.findMany.mockResolvedValue([])
    prisma.parentMeeting.count.mockResolvedValue(0)

    const response = await getParentMeetings(createRequest())
    expect(response.status).toBe(200)

    // Lookup figli guardian-aware (StudentGuardian + fallback parentUserId)
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: expect.arrayContaining([
            { parentUserId: 'parent-1' },
            { guardians: { some: { userId: 'parent-1' } } },
          ]),
        }),
      })
    )

    // La query dei colloqui resta vincolata ai soli figli del genitore
    expect(prisma.parentMeeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          studentId: { in: ['s1', 's2'] },
        }),
      })
    )
  })

  it('(d-bis) PARENT senza figli: lista vuota senza query sui colloqui', async () => {
    getAuth.mockResolvedValue(parentSession)
    prisma.student.findMany.mockResolvedValue([])

    const response = await getParentMeetings(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.meetings).toEqual([])
    expect(prisma.parentMeeting.findMany).not.toHaveBeenCalled()
  })
})
