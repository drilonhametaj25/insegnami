/**
 * Test TDD per lib/notifications/dispatcher (B3.2 + B3.4)
 *
 * Contratto del dispatcher "onesto":
 * - createAndDispatch crea la riga Notification con emailSent=false e la
 *   flippa a true SOLO dopo che l'enqueue dell'email è andato a buon fine
 * - coda giù (enqueue fallisce) → emailSent resta false, warn, nessun throw
 * - quota per-tenant esaurita (rateLimitByKey → false) → nessun enqueue,
 *   reason 'quota-exceeded', emailSent resta false
 */

jest.mock('@/lib/db', () => ({
  prisma: {
    notification: { create: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    notificationPreferences: { findUnique: jest.fn() },
    emailLog: { create: jest.fn() },
  },
}))

jest.mock('@/lib/email-queue', () => ({
  EmailNotificationService: { sendGenericEmail: jest.fn() },
}))

// Fallback SMTP diretto (import dinamico nel dispatcher)
jest.mock('@/lib/email', () => ({
  emailService: { sendEmail: jest.fn() },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitByKey: jest.fn(),
}))

jest.mock('@/lib/api-middleware', () => ({
  escapeHtml: (s: string) => s,
}))

import { createAndDispatch, dispatchNotification, quietHoursDelayMs } from '@/lib/notifications/dispatcher'

const { prisma } = require('@/lib/db')
const { EmailNotificationService } = require('@/lib/email-queue')
const { emailService } = require('@/lib/email')
const { logger } = require('@/lib/logger')
const { rateLimitByKey } = require('@/lib/rate-limit')

// Riga Notification come tornerebbe da Prisma dopo la create
const baseNotification = {
  id: 'notif-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  title: 'Titolo di prova',
  content: 'Contenuto di prova',
  type: 'SYSTEM',
  priority: 'NORMAL',
  status: 'UNREAD',
  actionUrl: null,
  actionLabel: null,
  sourceType: null,
  sourceId: null,
  scheduledFor: null,
  expiresAt: null,
  emailSent: false,
  pushSent: false,
} as any

describe('dispatcher (B3.2 + B3.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: quota disponibile, destinatario con email, enqueue ok,
    // nessuna preferenza salvata (default), fallback SMTP non disponibile
    rateLimitByKey.mockResolvedValue(true)
    prisma.notification.create.mockResolvedValue({ ...baseNotification })
    prisma.notification.update.mockResolvedValue({ ...baseNotification, emailSent: true })
    prisma.user.findUnique.mockResolvedValue({ email: 'genitore@test.it' })
    prisma.notificationPreferences.findUnique.mockResolvedValue(null)
    prisma.emailLog.create.mockResolvedValue({ id: 'log-1' })
    EmailNotificationService.sendGenericEmail.mockResolvedValue(undefined)
    emailService.sendEmail.mockResolvedValue({ success: false, error: 'smtp unavailable' })
  })

  describe('createAndDispatch', () => {
    it('crea la notifica con emailSent=false e flippa a true SOLO dopo enqueue riuscito', async () => {
      const result = await createAndDispatch(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          title: 'Titolo di prova',
          content: 'Contenuto di prova',
          type: 'SYSTEM' as any,
        },
        { sendEmail: true },
      )

      // La riga nasce SEMPRE con emailSent=false (flag onesto)
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailSent: false, pushSent: false }),
        }),
      )

      // Il flip a true avviene solo dopo l'enqueue riuscito
      expect(EmailNotificationService.sendGenericEmail).toHaveBeenCalledTimes(1)
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { emailSent: true },
      })

      // Ordine: prima enqueue, poi flip del flag
      const enqueueOrder = EmailNotificationService.sendGenericEmail.mock.invocationCallOrder[0]
      const updateOrder = prisma.notification.update.mock.invocationCallOrder[0]
      expect(enqueueOrder).toBeLessThan(updateOrder)

      expect(result.emailEnqueued).toBe(true)
    })

    it('coda giù → emailSent resta false, warn loggato, nessun throw', async () => {
      EmailNotificationService.sendGenericEmail.mockRejectedValue(new Error('Redis down'))

      // Nessun throw verso il chiamante
      const result = await createAndDispatch(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          title: 'Titolo di prova',
          content: 'Contenuto di prova',
          type: 'SYSTEM' as any,
        },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(false)
      // Il flag NON viene flippato: nessuna update su emailSent
      expect(prisma.notification.update).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('dispatchNotification — quota per-tenant (B3.4)', () => {
    it('quota esaurita → nessun enqueue, reason quota-exceeded, emailSent resta false', async () => {
      rateLimitByKey.mockResolvedValue(false)

      const result = await dispatchNotification(
        { ...baseNotification, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      // Quota consultata con chiave tenant e prefisso dedicato alla coda email
      expect(rateLimitByKey).toHaveBeenCalledWith('tenant-1', 500, 3600000, 'rl:queue:email')
      expect(EmailNotificationService.sendGenericEmail).not.toHaveBeenCalled()
      expect(prisma.notification.update).not.toHaveBeenCalled()
      expect(result.emailEnqueued).toBe(false)
      expect(result.reason).toBe('quota-exceeded')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('quota disponibile → enqueue e flip del flag', async () => {
      const result = await dispatchNotification(
        { ...baseNotification, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(EmailNotificationService.sendGenericEmail).toHaveBeenCalledTimes(1)
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { emailSent: true },
      })
      expect(result.emailEnqueued).toBe(true)
    })

    it('emailSent già true → skip idempotente senza consumare quota', async () => {
      const result = await dispatchNotification(
        { ...baseNotification, emailSent: true, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(false)
      expect(result.reason).toBe('already-sent')
      // Lo skip non deve bruciare uno slot di quota
      expect(rateLimitByKey).not.toHaveBeenCalled()
      expect(EmailNotificationService.sendGenericEmail).not.toHaveBeenCalled()
    })

    it('destinatario senza email → reason no-recipient-email senza consumare quota', async () => {
      const result = await dispatchNotification(
        { ...baseNotification, user: { email: null } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(false)
      expect(result.reason).toBe('no-recipient-email')
      expect(rateLimitByKey).not.toHaveBeenCalled()
      expect(EmailNotificationService.sendGenericEmail).not.toHaveBeenCalled()
    })
  })

  describe('dispatchNotification — preferenze utente (3C2)', () => {
    it('emailEnabled=false → niente email, reason email-disabled (in-app resta)', async () => {
      prisma.notificationPreferences.findUnique.mockResolvedValue({
        emailEnabled: false,
        typePreferences: {},
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      })

      const result = await dispatchNotification(
        { ...baseNotification, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(false)
      expect(result.reason).toBe('email-disabled')
      expect(EmailNotificationService.sendGenericEmail).not.toHaveBeenCalled()
      expect(prisma.notification.update).not.toHaveBeenCalled()
      // Le preferenze si controllano PRIMA di consumare quota
      expect(rateLimitByKey).not.toHaveBeenCalled()
    })

    it('typePreferences[type]=false → email saltata per quel tipo', async () => {
      prisma.notificationPreferences.findUnique.mockResolvedValue({
        emailEnabled: true,
        typePreferences: { SYSTEM: false },
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      })

      const result = await dispatchNotification(
        { ...baseNotification, type: 'SYSTEM', user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(false)
      expect(result.reason).toBe('type-disabled')
      expect(EmailNotificationService.sendGenericEmail).not.toHaveBeenCalled()
    })

    it('typePreferences con altro tipo disattivato → invio normale', async () => {
      prisma.notificationPreferences.findUnique.mockResolvedValue({
        emailEnabled: true,
        typePreferences: { PAYMENT: false },
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      })

      const result = await dispatchNotification(
        { ...baseNotification, type: 'SYSTEM', user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(true)
      expect(EmailNotificationService.sendGenericEmail).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispatchNotification — quiet hours', () => {
    it('quietHoursDelayMs: dentro la finestra stessa-giornata → delay fino alla fine', () => {
      // 14:00 UTC dentro 13:00→15:00 → 60 minuti di attesa
      const now = new Date('2026-01-15T14:00:00Z')
      expect(quietHoursDelayMs(now, '13:00', '15:00', 'UTC')).toBe(60 * 60_000)
    })

    it('quietHoursDelayMs: fuori dalla finestra → 0', () => {
      const now = new Date('2026-01-15T12:00:00Z')
      expect(quietHoursDelayMs(now, '13:00', '15:00', 'UTC')).toBe(0)
    })

    it('quietHoursDelayMs: finestra a cavallo di mezzanotte', () => {
      // 23:00 dentro 22:00→08:00 → 9 ore
      const night = new Date('2026-01-15T23:00:00Z')
      expect(quietHoursDelayMs(night, '22:00', '08:00', 'UTC')).toBe(9 * 60 * 60_000)
      // 07:00 dentro 22:00→08:00 → 1 ora
      const morning = new Date('2026-01-15T07:00:00Z')
      expect(quietHoursDelayMs(morning, '22:00', '08:00', 'UTC')).toBe(60 * 60_000)
      // 12:00 fuori → 0
      const day = new Date('2026-01-15T12:00:00Z')
      expect(quietHoursDelayMs(day, '22:00', '08:00', 'UTC')).toBe(0)
    })

    it('quietHoursDelayMs: input invalidi → 0 (nessun posticipo)', () => {
      const now = new Date('2026-01-15T14:00:00Z')
      expect(quietHoursDelayMs(now, null, '15:00', 'UTC')).toBe(0)
      expect(quietHoursDelayMs(now, 'abc', '15:00', 'UTC')).toBe(0)
      expect(quietHoursDelayMs(now, '14:00', '14:00', 'UTC')).toBe(0)
    })

    it('quiet hours attive e "adesso" in finestra → enqueue con delay e scheduledFor posticipato', async () => {
      // Finestra costruita attorno all'ora corrente in Europe/Rome (tz del dispatcher)
      const fmt = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      const [h, m] = fmt.format(new Date()).split(':').map(Number)
      const nowMin = h * 60 + m
      const toHHMM = (min: number) => {
        const norm = ((min % 1440) + 1440) % 1440
        return `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}`
      }
      prisma.notificationPreferences.findUnique.mockResolvedValue({
        emailEnabled: true,
        typePreferences: {},
        quietHoursEnabled: true,
        quietHoursStart: toHHMM(nowMin - 60),
        quietHoursEnd: toHHMM(nowMin + 60),
      })

      const result = await dispatchNotification(
        { ...baseNotification, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(true)
      expect(result.reason).toMatch(/^delayed-/)

      // L'enqueue riceve un delay positivo (~fino alla fine della finestra)
      const call = EmailNotificationService.sendGenericEmail.mock.calls[0]
      expect(call[1]).toEqual(expect.objectContaining({ delay: expect.any(Number) }))
      expect(call[1].delay).toBeGreaterThan(0)
      expect(call[1].delay).toBeLessThanOrEqual(61 * 60_000)

      // scheduledFor della riga posticipato di conseguenza
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailSent: true,
            scheduledFor: expect.any(Date),
          }),
        }),
      )
    })
  })

  describe('dispatchNotification — fallback SMTP diretto', () => {
    it('coda giù e SMTP ok → invio diretto, emailSent flippato, EmailLog SENT', async () => {
      EmailNotificationService.sendGenericEmail.mockRejectedValue(new Error('Redis down'))
      emailService.sendEmail.mockResolvedValue({ success: true, messageId: 'smtp-1' })

      const result = await dispatchNotification(
        { ...baseNotification, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(true)
      expect(result.reason).toBe('smtp-fallback')

      // SMTP diretto: useQueue=false per non rientrare in coda
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'genitore@test.it' }),
        false,
      )

      // EmailLog anche dal fallback
      expect(prisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SENT',
            to: 'genitore@test.it',
            tenantId: 'tenant-1',
          }),
        }),
      )

      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { emailSent: true } }),
      )
    })

    it('coda giù e SMTP giù → emailSent resta false, EmailLog FAILED', async () => {
      EmailNotificationService.sendGenericEmail.mockRejectedValue(new Error('Redis down'))
      emailService.sendEmail.mockResolvedValue({ success: false, error: 'no smtp' })

      const result = await dispatchNotification(
        { ...baseNotification, user: { email: 'genitore@test.it' } },
        { sendEmail: true },
      )

      expect(result.emailEnqueued).toBe(false)
      expect(result.reason).toBe('queue-unavailable')
      expect(prisma.notification.update).not.toHaveBeenCalled()
      expect(prisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      )
    })
  })
})
