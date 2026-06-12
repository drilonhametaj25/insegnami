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
  },
}))

jest.mock('@/lib/email-queue', () => ({
  EmailNotificationService: { sendGenericEmail: jest.fn() },
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

import { createAndDispatch, dispatchNotification } from '@/lib/notifications/dispatcher'

const { prisma } = require('@/lib/db')
const { EmailNotificationService } = require('@/lib/email-queue')
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
    // Default: quota disponibile, destinatario con email, enqueue ok
    rateLimitByKey.mockResolvedValue(true)
    prisma.notification.create.mockResolvedValue({ ...baseNotification })
    prisma.notification.update.mockResolvedValue({ ...baseNotification, emailSent: true })
    prisma.user.findUnique.mockResolvedValue({ email: 'genitore@test.it' })
    EmailNotificationService.sendGenericEmail.mockResolvedValue(undefined)
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
})
