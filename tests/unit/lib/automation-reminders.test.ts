/**
 * Test per i solleciti di pagamento (3C2):
 * - setupPaymentReminders: le query overdue/final-notice includono OVERDUE
 *   (il cron mark-payments-overdue ha già spostato i PENDING scaduti)
 * - EMAIL_TEMPLATES.paymentReminder: esiste un template per OGNI tipo
 *   accodabile (due-soon, overdue, final-notice)
 * - processPaymentReminder: skip se il payment è PAID; dedup via EmailLog
 *   (stesso payment+tipo negli ultimi 3 giorni); EmailLog scritto dopo l'invio
 */

const mockQueueAdd = jest.fn()

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}))

jest.mock('@/lib/redis', () => ({
  redis: { getConnectionConfig: jest.fn(() => ({ host: 'localhost', port: 6379 })) },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitByKey: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    payment: { findMany: jest.fn(), findUnique: jest.fn() },
    lesson: { findMany: jest.fn() },
    emailLog: { findFirst: jest.fn(), create: jest.fn() },
  },
}))

import { AutomationService } from '@/lib/automation-service'
import { EMAIL_TEMPLATES, processPaymentReminder } from '@/lib/automation-worker'

const { prisma } = require('@/lib/db')
const { sendEmail } = require('@/lib/email')

const basePayment = {
  id: 'payment-1',
  tenantId: 'tenant-1',
  status: 'OVERDUE',
  amount: 120,
  description: 'Retta ottobre',
  dueDate: new Date('2026-08-20T00:00:00Z'),
  student: {
    id: 'student-1',
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario@test.it',
    parentUser: { email: 'genitore@test.it', firstName: 'Anna', lastName: 'Rossi' },
  },
}

describe('setupPaymentReminders — query con OVERDUE', () => {
  let scheduleSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.payment.findMany.mockResolvedValue([])
    scheduleSpy = jest
      .spyOn(AutomationService, 'schedulePaymentReminder')
      .mockResolvedValue(undefined as any)
  })

  afterEach(() => {
    scheduleSpy.mockRestore()
  })

  it('overdue e final-notice interrogano status IN (PENDING, OVERDUE)', async () => {
    await AutomationService.setupPaymentReminders()

    expect(prisma.payment.findMany).toHaveBeenCalledTimes(3)
    const [dueSoonArgs, overdueArgs, finalNoticeArgs] = prisma.payment.findMany.mock.calls.map(
      (c: any[]) => c[0],
    )

    // due-soon: scadenza futura, ancora PENDING
    expect(dueSoonArgs.where.status).toBe('PENDING')

    // overdue / final-notice: il cron può averli già spostati a OVERDUE
    expect(overdueArgs.where.status).toEqual({ in: ['PENDING', 'OVERDUE'] })
    expect(finalNoticeArgs.where.status).toEqual({ in: ['PENDING', 'OVERDUE'] })
  })

  it('accoda un reminder per ogni payment trovato, col tipo giusto', async () => {
    prisma.payment.findMany
      .mockResolvedValueOnce([{ id: 'p-due' }])
      .mockResolvedValueOnce([{ id: 'p-over' }])
      .mockResolvedValueOnce([{ id: 'p-final' }])

    await AutomationService.setupPaymentReminders()

    expect(scheduleSpy).toHaveBeenCalledWith('p-due', 'due-soon')
    expect(scheduleSpy).toHaveBeenCalledWith('p-over', 'overdue')
    expect(scheduleSpy).toHaveBeenCalledWith('p-final', 'final-notice')
  })

  it('errore nella query → logga E rilancia (niente catch inghiottito)', async () => {
    prisma.payment.findMany.mockRejectedValue(new Error('db down'))
    await expect(AutomationService.setupPaymentReminders()).rejects.toThrow('db down')
  })
})

describe('EMAIL_TEMPLATES.paymentReminder — copertura tipi', () => {
  it('esiste un template (subject + body) per ogni tipo accodabile', () => {
    const queueableTypes: Array<'due-soon' | 'overdue' | 'final-notice'> = [
      'due-soon',
      'overdue',
      'final-notice',
    ]
    for (const type of queueableTypes) {
      const template = EMAIL_TEMPLATES.paymentReminder[type]
      expect(template).toBeDefined()
      expect(typeof template.subject).toBe('string')
      expect(template.subject.length).toBeGreaterThan(0)
      expect(typeof template.template).toBe('string')
      expect(template.template.length).toBeGreaterThan(0)
    }
  })

  it('final-notice ha tono di messa in mora soft (sollecito, non minaccia)', () => {
    const finalNotice = EMAIL_TEMPLATES.paymentReminder['final-notice']
    expect(finalNotice.subject.toLowerCase()).toContain('sollecito')
    expect(finalNotice.template).toContain('{{daysOverdue}}')
    expect(finalNotice.template).toContain('{{amount}}')
  })
})

describe('processPaymentReminder — skip PAID e dedup EmailLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.emailLog.findFirst.mockResolvedValue(null)
    prisma.emailLog.create.mockResolvedValue({ id: 'log-1' })
    sendEmail.mockResolvedValue({ success: true, queued: true })
  })

  it('payment PAID → nessun invio e nessun accesso al registro', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...basePayment, status: 'PAID' })

    await processPaymentReminder({ paymentId: 'payment-1', reminderType: 'overdue' })

    expect(sendEmail).not.toHaveBeenCalled()
    expect(prisma.emailLog.findFirst).not.toHaveBeenCalled()
    expect(prisma.emailLog.create).not.toHaveBeenCalled()
  })

  it('payment CANCELLED → nessun invio', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...basePayment, status: 'CANCELLED' })

    await processPaymentReminder({ paymentId: 'payment-1', reminderType: 'final-notice' })

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('dedup: sollecito recente in EmailLog → niente nuovo invio', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...basePayment })
    prisma.emailLog.findFirst.mockResolvedValue({ id: 'log-esistente' })

    await processPaymentReminder({ paymentId: 'payment-1', reminderType: 'overdue' })

    // La chiave di dedup è payment.id + tipo, finestra 3 giorni
    expect(prisma.emailLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: 'payment-reminder',
          sourceId: 'payment-1:overdue',
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    )
    expect(sendEmail).not.toHaveBeenCalled()
    expect(prisma.emailLog.create).not.toHaveBeenCalled()
  })

  it('nessun sollecito recente → invia a studente e genitore e scrive EmailLog', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...basePayment })

    await processPaymentReminder({ paymentId: 'payment-1', reminderType: 'overdue' })

    // Due destinatari: studente + genitore
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'mario@test.it' }),
    )
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'genitore@test.it' }),
    )

    // EmailLog QUEUED per ogni invio accodato (base del dedup)
    expect(prisma.emailLog.create).toHaveBeenCalledTimes(2)
    expect(prisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          sourceType: 'payment-reminder',
          sourceId: 'payment-1:overdue',
          status: 'QUEUED',
        }),
      }),
    )
  })

  it('invio fallito → EmailLog FAILED con errore', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...basePayment })
    sendEmail.mockResolvedValue({ success: false, queued: false, error: 'smtp down' })

    await processPaymentReminder({ paymentId: 'payment-1', reminderType: 'final-notice' })

    expect(prisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'smtp down',
        }),
      }),
    )
  })
})
