/**
 * cron-scheduler — test unitari per:
 *  - withAuditRun: bookkeeping AutomationRun (RUNNING → SUCCESS/FAILED) senza
 *    silenziare gli errori di bookkeeping (logger.warn) e senza bloccare il job
 *  - parentAttendanceDigest: digest assenze/ritardi del giorno precedente
 *    (finestra Europe/Rome), raggruppato per genitore, una notifica per genitore
 */

jest.mock('bullmq', () => ({
  Queue: jest.fn(),
  Worker: jest.fn(),
}))

jest.mock('@/lib/redis', () => ({
  redis: { getConnectionConfig: jest.fn() },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    attendance: { findMany: jest.fn() },
    automationRun: { create: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/automation-service', () => ({
  AutomationService: { runDailyAutomation: jest.fn() },
}))

jest.mock('@/lib/notifications/billing-notifications', () => ({
  notifyTenantAdmins: jest.fn(),
}))

jest.mock('@/lib/notifications/dispatcher', () => ({
  createAndDispatch: jest.fn(),
}))

import { parentAttendanceDigest, withAuditRun } from '@/lib/workers/cron-scheduler'

const { prisma } = require('@/lib/db')
const { createAndDispatch } = require('@/lib/notifications/dispatcher')
const { logger } = require('@/lib/logger')

/** Record di presenza come restituito da prisma.attendance.findMany (mock). */
function makeRecord(opts: {
  status: 'ABSENT' | 'LATE'
  firstName: string
  lastName: string
  parentUserId: string | null
  lessonTitle: string
  className: string
  tenantId?: string
}) {
  return {
    id: `att-${opts.firstName}-${opts.lessonTitle}`,
    status: opts.status,
    student: {
      firstName: opts.firstName,
      lastName: opts.lastName,
      parentUserId: opts.parentUserId,
    },
    lesson: {
      title: opts.lessonTitle,
      startTime: new Date(),
      tenantId: opts.tenantId ?? 'tenant-1',
      class: { name: opts.className },
    },
  }
}

describe('parentAttendanceDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.attendance.findMany.mockResolvedValue([])
    createAndDispatch.mockResolvedValue({ notification: { id: 'n-1' }, emailEnqueued: true })
  })

  it('raggruppa per genitore: una sola notifica per genitore, skip senza parentUser', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      // due figli dello stesso genitore, entrambi assenti
      makeRecord({ status: 'ABSENT', firstName: 'Mario', lastName: 'Rossi', parentUserId: 'parent-1', lessonTitle: 'Matematica', className: '1A' }),
      makeRecord({ status: 'ABSENT', firstName: 'Luca', lastName: 'Rossi', parentUserId: 'parent-1', lessonTitle: 'Inglese', className: '2B' }),
      // ritardo di un figlio di un altro genitore
      makeRecord({ status: 'LATE', firstName: 'Sara', lastName: 'Verdi', parentUserId: 'parent-2', lessonTitle: 'Storia', className: '3C' }),
      // studente senza account genitore collegato: nessuna notifica
      makeRecord({ status: 'ABSENT', firstName: 'Anna', lastName: 'Bianchi', parentUserId: null, lessonTitle: 'Scienze', className: '1A' }),
    ])

    const result = await parentAttendanceDigest()

    // Esattamente 2 notifiche (parent-1 e parent-2), niente per lo studente orfano
    expect(createAndDispatch).toHaveBeenCalledTimes(2)

    const calls = createAndDispatch.mock.calls
    const forParent1 = calls.find(([data]: any[]) => data.userId === 'parent-1')
    const forParent2 = calls.find(([data]: any[]) => data.userId === 'parent-2')
    expect(forParent1).toBeDefined()
    expect(forParent2).toBeDefined()

    // Contenuto raggruppato: entrambi i figli nella stessa notifica
    const [data1, opts1] = forParent1!
    expect(data1.content).toContain('Mario Rossi — Matematica (1A) — Assente')
    expect(data1.content).toContain('Luca Rossi — Inglese (2B) — Assente')
    expect(data1.tenantId).toBe('tenant-1')
    expect(data1.type).toBe('ATTENDANCE')
    expect(data1.actionUrl).toBe('/dashboard/parent')
    expect(opts1).toEqual(expect.objectContaining({ sendEmail: true }))

    const [data2] = forParent2!
    expect(data2.content).toContain('Sara Verdi — Storia (3C) — In ritardo')
    expect(data2.content).not.toContain('Mario Rossi')

    expect(result).toEqual({ pendingDigests: 2, emailsEnqueued: 2 })
  })

  it('interroga la finestra [ieri 00:00, oggi 00:00) in Europe/Rome', async () => {
    await parentAttendanceDigest()

    expect(prisma.attendance.findMany).toHaveBeenCalledTimes(1)
    const arg = prisma.attendance.findMany.mock.calls[0][0]

    // Filtro stato: solo assenze e ritardi
    expect(arg.where.status).toEqual({ in: ['ABSENT', 'LATE'] })

    const { gte, lt } = arg.where.lesson.startTime
    expect(gte).toBeInstanceOf(Date)
    expect(lt).toBeInstanceOf(Date)
    expect(lt.getTime()).toBeGreaterThan(gte.getTime())

    // Entrambi i confini sono mezzanotte civile a Roma
    const fmtTime = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
    })
    expect(fmtTime.format(lt)).toBe('00:00')
    expect(fmtTime.format(gte)).toBe('00:00')

    // lt = mezzanotte di OGGI a Roma; gte = mezzanotte del giorno civile precedente
    const fmtDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    })
    expect(fmtDay.format(lt)).toBe(fmtDay.format(new Date()))
    expect(fmtDay.format(gte)).toBe(fmtDay.format(new Date(lt.getTime() - 1)))
  })

  it('un errore su un genitore non blocca gli altri (warn + conteggi corretti)', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      makeRecord({ status: 'ABSENT', firstName: 'Mario', lastName: 'Rossi', parentUserId: 'parent-1', lessonTitle: 'Matematica', className: '1A' }),
      makeRecord({ status: 'LATE', firstName: 'Sara', lastName: 'Verdi', parentUserId: 'parent-2', lessonTitle: 'Storia', className: '3C' }),
    ])
    createAndDispatch
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce({ notification: { id: 'n-2' }, emailEnqueued: true })

    const result = await parentAttendanceDigest()

    expect(createAndDispatch).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalled()
    expect(result).toEqual({ pendingDigests: 2, emailsEnqueued: 1 })
  })

  it('senza assenze/ritardi non invia nulla', async () => {
    const result = await parentAttendanceDigest()
    expect(createAndDispatch).not.toHaveBeenCalled()
    expect(result).toEqual({ pendingDigests: 0, emailsEnqueued: 0 })
  })
})

describe('withAuditRun', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.automationRun.create.mockResolvedValue({ id: 'run-1' })
    prisma.automationRun.update.mockResolvedValue({ id: 'run-1' })
  })

  it('successo: create RUNNING, poi update SUCCESS con il risultato', async () => {
    const fn = jest.fn().mockResolvedValue({ updated: 3 })

    const result = await withAuditRun('mark-payments-overdue', fn)

    expect(result).toEqual({ updated: 3 })
    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobName: 'mark-payments-overdue',
          status: 'RUNNING',
          startedAt: expect.any(Date),
        }),
      })
    )
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          finishedAt: expect.any(Date),
        }),
      })
    )
  })

  it('fn che lancia: update FAILED con messaggio e rethrow', async () => {
    const boom = new Error('db esplosa')
    const fn = jest.fn().mockRejectedValue(boom)

    await expect(withAuditRun('daily-automation', fn)).rejects.toThrow('db esplosa')

    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: expect.stringContaining('db esplosa'),
          finishedAt: expect.any(Date),
        }),
      })
    )
  })

  it('errore nel create del bookkeeping: fn eseguita comunque + logger.warn', async () => {
    prisma.automationRun.create.mockRejectedValue(new Error('tabella mancante'))
    const fn = jest.fn().mockResolvedValue({ ok: true })

    const result = await withAuditRun('parent-attendance-digest', fn)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('AutomationRun bookkeeping failed'),
      expect.any(Error)
    )
    // Senza runId niente update
    expect(prisma.automationRun.update).not.toHaveBeenCalled()
  })

  it('errore nell update di chiusura: il risultato del job viene comunque restituito + logger.warn', async () => {
    prisma.automationRun.update.mockRejectedValue(new Error('update fallita'))
    const fn = jest.fn().mockResolvedValue({ ok: true })

    const result = await withAuditRun('auto-complete-lessons', fn)

    expect(result).toEqual({ ok: true })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('AutomationRun bookkeeping failed'),
      expect.any(Error)
    )
  })
})
