/**
 * Test TDD per PATCH /api/lessons/recurring — modifica di una serie di lezioni ricorrenti.
 *
 * Pattern: come crud.test.ts — mock di @/lib/auth, @/lib/db, @/lib/tenant-guard,
 * @/lib/api-auth e @/lib/lessons/conflicts. Il route handler viene invocato
 * direttamente con una request finta.
 */
import { PATCH as patchSeries } from '@/app/api/lessons/recurring/route'

// Mock auth (il file route importa sia auth — usato dal POST — sia getAuth)
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getAuth: jest.fn(),
}))

// Mock tenant guard (enforcement testato in tenant-guard.test.ts)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock risoluzione Teacher.id dall'utente autenticato
jest.mock('@/lib/api-auth', () => ({
  getTeacherIdForUser: jest.fn(),
}))

// Mock helper conflitti (la logica reale è testata più sotto con requireActual)
jest.mock('@/lib/lessons/conflicts', () => ({
  findLessonConflicts: jest.fn(),
  conflictMessage: jest.fn(() => 'Conflitto rilevato'),
}))

// Mock Prisma — $transaction espone un TransactionClient finto alla callback
const mockTx = {
  lesson: {
    update: jest.fn(),
  },
}

jest.mock('@/lib/db', () => ({
  prisma: {
    lesson: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    teacher: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const { getAuth } = require('@/lib/auth')
const { getTeacherIdForUser } = require('@/lib/api-auth')
const { findLessonConflicts } = require('@/lib/lessons/conflicts')
const { prisma } = require('@/lib/db')

const T = (iso: string) => new Date(iso)

// Serie di esempio: root (template) + 3 occorrenze figlie, una COMPLETED
const root = {
  id: 'root-1',
  tenantId: 'tenant-1',
  classId: 'class-1',
  teacherId: 'teacher-1',
  title: 'Pianoforte',
  description: null,
  room: 'A1',
  isRecurring: true,
  parentLessonId: null,
  status: 'SCHEDULED',
  startTime: T('2026-01-05T10:00:00.000Z'),
  endTime: T('2026-01-05T11:00:00.000Z'),
}
const child1 = {
  ...root,
  id: 'child-1',
  parentLessonId: 'root-1',
  startTime: T('2026-01-12T10:00:00.000Z'),
  endTime: T('2026-01-12T11:00:00.000Z'),
}
const child2Completed = {
  ...root,
  id: 'child-2',
  parentLessonId: 'root-1',
  status: 'COMPLETED',
  startTime: T('2026-01-19T10:00:00.000Z'),
  endTime: T('2026-01-19T11:00:00.000Z'),
}
const child3 = {
  ...root,
  id: 'child-3',
  parentLessonId: 'root-1',
  startTime: T('2026-01-26T10:00:00.000Z'),
  endTime: T('2026-01-26T11:00:00.000Z'),
}
const fullSeries = [root, child1, child2Completed, child3]

function createRequest(body: any) {
  return {
    url: 'http://localhost:3000/api/lessons/recurring',
    method: 'PATCH',
    json: () => Promise.resolve(body),
  } as any
}

describe('PATCH /api/lessons/recurring — edit serie ricorrente', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
    })
    findLessonConflicts.mockResolvedValue([])
    prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx))
    mockTx.lesson.update.mockResolvedValue({})
  })

  it('scope series: aggiorna root + figli, esclude le COMPLETED', async () => {
    prisma.lesson.findFirst.mockResolvedValue(child1)
    prisma.lesson.findMany.mockResolvedValue(fullSeries)

    const res = await patchSeries(
      createRequest({ lessonId: 'child-1', scope: 'series', data: { title: 'Nuovo titolo' } })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ updated: 3, scope: 'series' })

    // La radice è risolta da parentLessonId e la serie è scoped sul tenant
    expect(prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [{ id: 'root-1' }, { parentLessonId: 'root-1' }],
        }),
      })
    )

    const updatedIds = mockTx.lesson.update.mock.calls.map((c: any[]) => c[0].where.id)
    expect(updatedIds).toHaveLength(3)
    expect(updatedIds).toEqual(expect.arrayContaining(['root-1', 'child-1', 'child-3']))
    // La COMPLETED non viene riscritta
    expect(updatedIds).not.toContain('child-2')
    // Campo "valore" applicato uguale a tutte le occorrenze
    for (const call of mockTx.lesson.update.mock.calls) {
      expect(call[0].data.title).toBe('Nuovo titolo')
    }
  })

  it('scope future: non tocca le occorrenze passate rispetto alla lezione di riferimento', async () => {
    prisma.lesson.findFirst.mockResolvedValue(child1)
    prisma.lesson.findMany.mockResolvedValue(fullSeries)

    const res = await patchSeries(
      createRequest({ lessonId: 'child-1', scope: 'future', data: { room: 'B2' } })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    // child-1 e child-3 (child-2 è COMPLETED, root è nel passato)
    expect(data).toEqual({ updated: 2, scope: 'future' })

    const updatedIds = mockTx.lesson.update.mock.calls.map((c: any[]) => c[0].where.id)
    expect(updatedIds).toEqual(expect.arrayContaining(['child-1', 'child-3']))
    expect(updatedIds).not.toContain('root-1')
    expect(updatedIds).not.toContain('child-2')

    // Il cambio aula richiede conflict detection per ogni target,
    // escludendo TUTTE le lezioni della serie dai confronti
    expect(findLessonConflicts).toHaveBeenCalledTimes(2)
    for (const call of findLessonConflicts.mock.calls) {
      expect(call[0].excludeLessonIds).toEqual(
        expect.arrayContaining(['root-1', 'child-1', 'child-2', 'child-3'])
      )
      expect(call[0].room).toBe('B2')
    }
  })

  it('scope single: aggiorna solo la lezione di riferimento', async () => {
    prisma.lesson.findFirst.mockResolvedValue(child3)
    prisma.lesson.findMany.mockResolvedValue(fullSeries)

    const res = await patchSeries(
      createRequest({ lessonId: 'child-3', scope: 'single', data: { title: 'Solo questa' } })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ updated: 1, scope: 'single' })
    expect(mockTx.lesson.update).toHaveBeenCalledTimes(1)
    expect(mockTx.lesson.update.mock.calls[0][0].where.id).toBe('child-3')
  })

  it('applica startTime/endTime come DELTA su ogni occorrenza, non come valore assoluto', async () => {
    prisma.lesson.findFirst.mockResolvedValue(child1)
    prisma.lesson.findMany.mockResolvedValue(fullSeries)

    // Riferimento child-1 alle 10:00 → spostata alle 10:30 (delta +30 min)
    const res = await patchSeries(
      createRequest({
        lessonId: 'child-1',
        scope: 'series',
        data: {
          startTime: '2026-01-12T10:30:00.000Z',
          endTime: '2026-01-12T11:30:00.000Z',
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ updated: 3, scope: 'series' })

    const byId: Record<string, any> = {}
    for (const call of mockTx.lesson.update.mock.calls) {
      byId[call[0].where.id] = call[0].data
    }
    // Ogni occorrenza viene shiftata di +30 minuti mantenendo la propria data
    expect(byId['root-1'].startTime).toEqual(T('2026-01-05T10:30:00.000Z'))
    expect(byId['root-1'].endTime).toEqual(T('2026-01-05T11:30:00.000Z'))
    expect(byId['child-1'].startTime).toEqual(T('2026-01-12T10:30:00.000Z'))
    expect(byId['child-1'].endTime).toEqual(T('2026-01-12T11:30:00.000Z'))
    expect(byId['child-3'].startTime).toEqual(T('2026-01-26T10:30:00.000Z'))
    expect(byId['child-3'].endTime).toEqual(T('2026-01-26T11:30:00.000Z'))
  })

  it('conflitto su una sola occorrenza → 400 e nessuna scrittura', async () => {
    prisma.lesson.findFirst.mockResolvedValue(child1)
    prisma.lesson.findMany.mockResolvedValue(fullSeries)

    // Il secondo target ha un conflitto aula con una lezione fuori serie
    findLessonConflicts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ kind: 'room', lessonId: 'other-1', room: 'A1' }])
      .mockResolvedValue([])

    const res = await patchSeries(
      createRequest({
        lessonId: 'child-1',
        scope: 'series',
        data: {
          startTime: '2026-01-12T10:30:00.000Z',
          endTime: '2026-01-12T11:30:00.000Z',
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.conflicts).toBeDefined()
    // NESSUNA scrittura: transazione mai aperta, nessuna update
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(mockTx.lesson.update).not.toHaveBeenCalled()
    expect(prisma.lesson.update).not.toHaveBeenCalled()
  })

  it('TEACHER non titolare della lezione → 403 senza scritture', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'user-2', email: 'prof@scuola.it', role: 'TEACHER', tenantId: 'tenant-1' },
    })
    getTeacherIdForUser.mockResolvedValue('teacher-99') // diverso da teacher-1
    prisma.lesson.findFirst.mockResolvedValue(child1)

    const res = await patchSeries(
      createRequest({ lessonId: 'child-1', scope: 'series', data: { title: 'Hack' } })
    )

    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(mockTx.lesson.update).not.toHaveBeenCalled()
  })

  it('lezione inesistente o di altro tenant → 404', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null)

    const res = await patchSeries(
      createRequest({ lessonId: 'ghost', scope: 'series', data: { title: 'X' } })
    )

    expect(res.status).toBe(404)
    expect(prisma.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'ghost', tenantId: 'tenant-1' }),
      })
    )
  })

  it('non autenticato → 401', async () => {
    getAuth.mockResolvedValue(null)

    const res = await patchSeries(
      createRequest({ lessonId: 'child-1', scope: 'series', data: { title: 'X' } })
    )

    expect(res.status).toBe(401)
  })

  it('body non valido (scope sconosciuto) → 400', async () => {
    const res = await patchSeries(
      createRequest({ lessonId: 'child-1', scope: 'tutte', data: { title: 'X' } })
    )

    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('findLessonConflicts — estensione excludeLessonIds (helper reale)', () => {
  // Usa l'implementazione reale dell'helper con il prisma mockato
  const realConflicts = jest.requireActual('@/lib/lessons/conflicts')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('esclude dai confronti sia excludeLessonId sia tutte le excludeLessonIds', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null)

    await realConflicts.findLessonConflicts({
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
      room: 'A1',
      startTime: T('2026-01-12T10:00:00.000Z'),
      endTime: T('2026-01-12T11:00:00.000Z'),
      excludeLessonId: 'x-1',
      excludeLessonIds: ['root-1', 'child-1'],
    })

    expect(prisma.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: expect.arrayContaining(['x-1', 'root-1', 'child-1']) },
        }),
      })
    )
  })

  it('resta retrocompatibile: rileva clash docente con il solo excludeLessonIds', async () => {
    prisma.lesson.findFirst
      .mockResolvedValueOnce({ id: 'clash-1', teacherId: 'teacher-1' }) // clash docente
      .mockResolvedValueOnce(null) // nessun clash aula

    const conflicts = await realConflicts.findLessonConflicts({
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
      room: 'A1',
      startTime: T('2026-01-12T10:00:00.000Z'),
      endTime: T('2026-01-12T11:00:00.000Z'),
      excludeLessonIds: ['root-1'],
    })

    expect(conflicts).toEqual([
      { kind: 'teacher', lessonId: 'clash-1', teacherId: 'teacher-1' },
    ])
  })
})
