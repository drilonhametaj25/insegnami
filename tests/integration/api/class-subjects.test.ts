/**
 * 3B1 — Struttura didattica: CRUD ClassSubject + sblocco generatori.
 *
 * Contratto:
 *  - GET/POST /api/classes/[id]/subjects e PUT/DELETE .../subjects/[subjectId]
 *    con envelope {data, meta}, validazione tenant e 409 sul duplicato.
 *  - Con ClassSubject presente, report-cards/generate e schedules/generate
 *    non falliscono più con 400 "nessuna materia".
 *
 * Pattern mock: vedi crud.test.ts / messages-groups.test.ts.
 */
import { GET as getClassSubjects, POST as postClassSubject } from '@/app/api/classes/[id]/subjects/route'
import { PUT as putClassSubject, DELETE as deleteClassSubject } from '@/app/api/classes/[id]/subjects/[subjectId]/route'

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock tenant guard (route legacy) e tenant access (route requireAuth)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/api-middleware', () => ({
  getPublicErrorMessage: (_err: any, fallback: string) => fallback,
}))

// Redis reale terrebbe aperto l'event loop di jest (connessione viva):
// mock con la shape usata da lib/billing/features (cache feature gate)
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getJSON: jest.fn().mockResolvedValue(null),
    setJSON: jest.fn().mockResolvedValue(undefined),
  },
}))

// L'algoritmo CSP è testato altrove: qui interessa solo che la route non
// risponda 400 quando le assegnazioni ClassSubject esistono
jest.mock('@/lib/scheduling', () => ({
  generateSchedule: jest.fn().mockResolvedValue({
    success: true,
    slots: [
      {
        dayOfWeek: 1,
        slotNumber: 1,
        startTime: '08:00',
        endTime: '09:00',
        classId: 'c1',
        subjectId: 's1',
        teacherId: 't1',
        room: null,
        score: 1,
        warnings: null,
      },
    ],
    score: 1,
    stats: {},
    errors: [],
    warnings: [],
  }),
  DEFAULT_CONFIG: {},
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    class: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    subject: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    teacher: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    classSubject: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    academicPeriod: {
      findFirst: jest.fn(),
    },
    studentClass: {
      findMany: jest.fn(),
    },
    grade: {
      findMany: jest.fn(),
    },
    reportCard: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    schedule: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    scheduleSlot: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    timeSlotConfig: {
      findMany: jest.fn(),
    },
    // Feature gate scheduleGenerator (lib/billing/features)
    tenant: {
      findUnique: jest.fn(),
    },
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

const adminSession = {
  user: { id: 'user-admin', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

function createRequest(url: string, method: string, body?: any) {
  return {
    url: `http://localhost${url}`,
    method,
    json: body ? () => Promise.resolve(body) : () => Promise.resolve({}),
  } as any
}

const routeParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as any

const mockClass = { id: 'c1', tenantId: 'tenant-1', teacherId: 't-default' }
const mockAssignment = {
  id: 'cs1',
  classId: 'c1',
  subjectId: 's1',
  teacherId: 't1',
  weeklyHours: 2,
  subject: { id: 's1', name: 'Matematica', code: 'MAT', color: null, weeklyHours: null },
  teacher: { id: 't1', firstName: 'Anna', lastName: 'Neri', email: 'anna@test.it' },
}

beforeEach(() => {
  jest.clearAllMocks()
  getAuth.mockResolvedValue(adminSession)
})

describe('GET /api/classes/[id]/subjects', () => {
  it('ritorna la lista con subject+teacher in envelope {data, meta}', async () => {
    prisma.class.findFirst.mockResolvedValue(mockClass)
    prisma.classSubject.findMany.mockResolvedValue([mockAssignment])

    const res = await getClassSubjects(
      createRequest('/api/classes/c1/subjects', 'GET'),
      routeParams({ id: 'c1' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].subject.name).toBe('Matematica')
    expect(body.data[0].teacher.lastName).toBe('Neri')
    expect(body.meta.total).toBe(1)

    // Scoping tenant sulla classe
    expect(prisma.class.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'c1', tenantId: 'tenant-1' }),
      })
    )
  })

  it('404 se la classe non appartiene al tenant', async () => {
    prisma.class.findFirst.mockResolvedValue(null)

    const res = await getClassSubjects(
      createRequest('/api/classes/altro/subjects', 'GET'),
      routeParams({ id: 'altro' })
    )
    expect(res.status).toBe(404)
  })

  it('401 se non autenticato', async () => {
    getAuth.mockResolvedValue(null)

    const res = await getClassSubjects(
      createRequest('/api/classes/c1/subjects', 'GET'),
      routeParams({ id: 'c1' })
    )
    expect(res.status).toBe(401)
  })
})

describe('POST /api/classes/[id]/subjects', () => {
  beforeEach(() => {
    prisma.class.findFirst.mockResolvedValue(mockClass)
    prisma.subject.findFirst.mockResolvedValue({ id: 's1' })
    prisma.teacher.findFirst.mockResolvedValue({ id: 't1' })
    prisma.classSubject.findFirst.mockResolvedValue(null)
    prisma.classSubject.create.mockResolvedValue(mockAssignment)
  })

  it('201 con teacherId esplicito e weeklyHours', async () => {
    const res = await postClassSubject(
      createRequest('/api/classes/c1/subjects', 'POST', {
        subjectId: 's1',
        teacherId: 't1',
        weeklyHours: 2,
      }),
      routeParams({ id: 'c1' })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe('cs1')
    expect(prisma.classSubject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { classId: 'c1', subjectId: 's1', teacherId: 't1', weeklyHours: 2 },
      })
    )
  })

  it('teacherId omesso → fallback sul docente titolare della classe', async () => {
    const res = await postClassSubject(
      createRequest('/api/classes/c1/subjects', 'POST', { subjectId: 's1' }),
      routeParams({ id: 'c1' })
    )

    expect(res.status).toBe(201)
    expect(prisma.classSubject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teacherId: 't-default', weeklyHours: 1 }),
      })
    )
  })

  it('409 esplicito sul duplicato (stessa materia già assegnata)', async () => {
    prisma.classSubject.findFirst.mockResolvedValue({ id: 'cs-existing' })

    const res = await postClassSubject(
      createRequest('/api/classes/c1/subjects', 'POST', { subjectId: 's1' }),
      routeParams({ id: 'c1' })
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/già assegnata/i)
    expect(prisma.classSubject.create).not.toHaveBeenCalled()
  })

  it('409 anche su race P2002 residua', async () => {
    prisma.classSubject.create.mockRejectedValue({ code: 'P2002' })

    const res = await postClassSubject(
      createRequest('/api/classes/c1/subjects', 'POST', { subjectId: 's1' }),
      routeParams({ id: 'c1' })
    )
    expect(res.status).toBe(409)
  })

  it('400 se la materia è di un altro tenant', async () => {
    prisma.subject.findFirst.mockResolvedValue(null)

    const res = await postClassSubject(
      createRequest('/api/classes/c1/subjects', 'POST', { subjectId: 's-altro' }),
      routeParams({ id: 'c1' })
    )
    expect(res.status).toBe(400)
    expect(prisma.classSubject.create).not.toHaveBeenCalled()
  })

  it('403 per ruolo senza class:update (STUDENT)', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'u-s', role: 'STUDENT', tenantId: 'tenant-1' },
    })

    const res = await postClassSubject(
      createRequest('/api/classes/c1/subjects', 'POST', { subjectId: 's1' }),
      routeParams({ id: 'c1' })
    )
    expect(res.status).toBe(403)
  })
})

describe('PUT/DELETE /api/classes/[id]/subjects/[subjectId]', () => {
  const scopedAssignment = {
    ...mockAssignment,
    class: { id: 'c1', tenantId: 'tenant-1' },
  }

  it('PUT aggiorna docente e ore', async () => {
    prisma.classSubject.findFirst.mockResolvedValue(scopedAssignment)
    prisma.teacher.findFirst.mockResolvedValue({ id: 't2' })
    prisma.classSubject.update.mockResolvedValue({ ...mockAssignment, teacherId: 't2', weeklyHours: 3 })

    const res = await putClassSubject(
      createRequest('/api/classes/c1/subjects/s1', 'PUT', { teacherId: 't2', weeklyHours: 3 }),
      routeParams({ id: 'c1', subjectId: 's1' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.weeklyHours).toBe(3)
    expect(prisma.classSubject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cs1' },
        data: { teacherId: 't2', weeklyHours: 3 },
      })
    )
  })

  it('PUT 404 se assegnazione di altro tenant', async () => {
    prisma.classSubject.findFirst.mockResolvedValue(null)

    const res = await putClassSubject(
      createRequest('/api/classes/c1/subjects/s1', 'PUT', { weeklyHours: 3 }),
      routeParams({ id: 'c1', subjectId: 's1' })
    )
    expect(res.status).toBe(404)
    expect(prisma.classSubject.update).not.toHaveBeenCalled()
  })

  it('DELETE rimuove l\'assegnazione', async () => {
    prisma.classSubject.findFirst.mockResolvedValue(scopedAssignment)
    prisma.classSubject.delete.mockResolvedValue(mockAssignment)

    const res = await deleteClassSubject(
      createRequest('/api/classes/c1/subjects/s1', 'DELETE'),
      routeParams({ id: 'c1', subjectId: 's1' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.deleted).toBe(true)
    expect(prisma.classSubject.delete).toHaveBeenCalledWith({ where: { id: 'cs1' } })
  })
})

describe('sblocco generatori con ClassSubject presente', () => {
  it('POST /api/report-cards/generate non risponde più 400 "nessuna materia"', async () => {
    const { POST: generateReportCards } = require('@/app/api/report-cards/generate/route')

    prisma.class.findFirst.mockResolvedValue({ id: 'c1', tenantId: 'tenant-1' })
    prisma.academicPeriod.findFirst.mockResolvedValue({ id: 'p1' })
    prisma.studentClass.findMany.mockResolvedValue([
      { student: { id: 'st1', firstName: 'Luca', lastName: 'Verdi' } },
    ])
    prisma.classSubject.findMany.mockResolvedValue([
      { id: 'cs1', classId: 'c1', subjectId: 's1', teacherId: 't1', weeklyHours: 2, subject: { id: 's1', name: 'Matematica' } },
    ])
    prisma.grade.findMany.mockResolvedValue([])
    prisma.reportCard.findFirst.mockResolvedValue(null)
    prisma.reportCard.create.mockResolvedValue({ id: 'rc1' })

    const res = await generateReportCards(
      createRequest('/api/report-cards/generate', 'POST', { classId: 'c1', periodId: 'p1' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.summary.created).toBe(1)
    // Le entries derivano dalle materie della classe
    expect(prisma.reportCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entries: expect.objectContaining({
            create: [expect.objectContaining({ subjectId: 's1' })],
          }),
        }),
      })
    )
  })

  it('POST /api/schedules/[id]/generate non risponde più 400 "nessuna assegnazione"', async () => {
    const { POST: generateScheduleRoute } = require('@/app/api/schedules/[id]/generate/route')

    // Feature gate: piano con scheduleGenerator attivo
    prisma.tenant.findUnique.mockResolvedValue({
      plan: 'pro',
      featureFlags: { scheduleGenerator: true },
      subscription: null,
    })
    prisma.schedule.findFirst.mockResolvedValue({
      id: 'sch1',
      tenantId: 'tenant-1',
      status: 'DRAFT',
      academicYearId: 'ay1',
      config: null,
    })
    prisma.class.findMany.mockResolvedValue([{ id: 'c1', name: '1A', code: 'C1' }])
    prisma.teacher.findMany.mockResolvedValue([{ id: 't1', firstName: 'Anna', lastName: 'Neri' }])
    prisma.subject.findMany.mockResolvedValue([{ id: 's1', name: 'Matematica', code: 'MAT' }])
    prisma.classSubject.findMany.mockResolvedValue([
      { classId: 'c1', subjectId: 's1', teacherId: 't1', weeklyHours: 2 },
    ])
    prisma.timeSlotConfig.findMany.mockResolvedValue([])
    prisma.scheduleSlot.deleteMany.mockResolvedValue({ count: 0 })
    prisma.scheduleSlot.createMany.mockResolvedValue({ count: 1 })
    prisma.schedule.update.mockResolvedValue({ id: 'sch1', status: 'GENERATED' })

    const res = await generateScheduleRoute(
      createRequest('/api/schedules/sch1/generate', 'POST', {}),
      routeParams({ id: 'sch1' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.slotsGenerated).toBe(1)
  })
})
