/**
 * Test TDD per le quote per-tenant anti-DoS all'enqueue (B3.4)
 *
 * - automation-service (scheduleAttendanceReminder / schedulePaymentReminder /
 *   checkClassCapacity): quota esaurita → niente enqueue + warn; quota ok → enqueue
 * - POST /api/messages/[id]/send: quota esaurita → 429 senza toccare il DB
 */

// I mock con prefisso "mock" sono referenziabili dentro le factory hoistate
const mockQueueAdd = jest.fn()

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}))

jest.mock('@/lib/redis', () => ({
  redis: {
    getConnectionConfig: jest.fn(() => ({ host: 'localhost', port: 6379 })),
    getClient: jest.fn(() => null),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitByKey: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}))

jest.mock('@/lib/email-queue', () => ({
  EmailNotificationService: { sendGenericEmail: jest.fn() },
}))

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
}))

jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lesson: { findUnique: jest.fn() },
    payment: { findUnique: jest.fn() },
    class: { findUnique: jest.fn() },
    message: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { AutomationService } from '@/lib/automation-service'
import { POST as sendMessage } from '@/app/api/messages/[id]/send/route'

const { prisma } = require('@/lib/db')
const { logger } = require('@/lib/logger')
const { rateLimitByKey } = require('@/lib/rate-limit')
const { getAuth } = require('@/lib/auth')
const { EmailNotificationService } = require('@/lib/email-queue')

describe('Quote per-tenant all\'enqueue (B3.4)', () => {
  beforeAll(() => {
    // La coda automation viene creata solo se REDIS_URL è configurato
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  beforeEach(() => {
    jest.clearAllMocks()
    rateLimitByKey.mockResolvedValue(true)
    mockQueueAdd.mockResolvedValue({ id: 'job-1' })
  })

  describe('AutomationService — quota rl:queue:automation', () => {
    const lesson = {
      id: 'lesson-1',
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
      teacher: {},
      class: { students: [] },
    }

    it('scheduleAttendanceReminder: quota esaurita → non accoda e logga warn', async () => {
      prisma.lesson.findUnique.mockResolvedValue(lesson)
      rateLimitByKey.mockResolvedValue(false)

      await AutomationService.scheduleAttendanceReminder('lesson-1', 'before-class')

      expect(rateLimitByKey).toHaveBeenCalledWith('tenant-1', 1000, 3600000, 'rl:queue:automation')
      expect(mockQueueAdd).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })

    it('scheduleAttendanceReminder: quota ok → accoda il job', async () => {
      prisma.lesson.findUnique.mockResolvedValue(lesson)

      await AutomationService.scheduleAttendanceReminder('lesson-1', 'before-class')

      expect(mockQueueAdd).toHaveBeenCalledTimes(1)
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'attendance-reminder',
        expect.objectContaining({ tenantId: 'tenant-1', lessonId: 'lesson-1' }),
        expect.objectContaining({ jobId: 'attendance-lesson-1-before-class' }),
      )
    })

    it('schedulePaymentReminder: quota esaurita → non accoda e logga warn', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        tenantId: 'tenant-1',
        studentId: 'student-1',
        student: {},
      })
      rateLimitByKey.mockResolvedValue(false)

      await AutomationService.schedulePaymentReminder('payment-1', 'due-soon')

      expect(rateLimitByKey).toHaveBeenCalledWith('tenant-1', 1000, 3600000, 'rl:queue:automation')
      expect(mockQueueAdd).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })

    it('schedulePaymentReminder: quota ok → accoda il job', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        tenantId: 'tenant-1',
        studentId: 'student-1',
        student: {},
      })

      await AutomationService.schedulePaymentReminder('payment-1', 'overdue')

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'payment-reminder',
        expect.objectContaining({ tenantId: 'tenant-1', paymentId: 'payment-1' }),
        expect.objectContaining({ jobId: 'payment-payment-1-overdue' }),
      )
    })

    it('checkClassCapacity: quota esaurita → non accoda anche se classe al 90%', async () => {
      prisma.class.findUnique.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-1',
        maxStudents: 10,
        students: new Array(9).fill({ studentId: 's' }),
      })
      rateLimitByKey.mockResolvedValue(false)

      await AutomationService.checkClassCapacity('class-1')

      expect(rateLimitByKey).toHaveBeenCalledWith('tenant-1', 1000, 3600000, 'rl:queue:automation')
      expect(mockQueueAdd).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })

    it('checkClassCapacity: quota ok e classe al 90% → accoda il warning', async () => {
      prisma.class.findUnique.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-1',
        maxStudents: 10,
        students: new Array(9).fill({ studentId: 's' }),
      })

      await AutomationService.checkClassCapacity('class-1')

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'class-capacity-warning',
        expect.objectContaining({ tenantId: 'tenant-1', classId: 'class-1' }),
        expect.objectContaining({ jobId: 'capacity-class-1' }),
      )
    })
  })

  describe('POST /api/messages/[id]/send — quota rl:queue:msgsend', () => {
    const baseMessage = {
      id: 'msg-1',
      tenantId: 'tenant-1',
      senderId: 'user-1',
      status: 'DRAFT',
      title: 'Avviso',
      content: 'Contenuto del messaggio',
      emailSubject: 'Avviso',
      sendEmail: true,
      sendSms: false,
      sendPush: false,
      recipients: [
        { user: { id: 'u2', firstName: 'A', lastName: 'B', email: 'a@test.it' } },
        { user: { id: 'u3', firstName: 'C', lastName: 'D', email: 'c@test.it' } },
      ],
    }

    function createRequest() {
      return {
        url: 'http://localhost:3000/api/messages/msg-1/send',
        method: 'POST',
        headers: { get: () => null },
      } as any
    }

    const routeParams = { params: Promise.resolve({ id: 'msg-1' }) }

    beforeEach(() => {
      getAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
      })
      // Il $transaction esegue il callback con un client tx mockato
      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          message: {
            update: jest.fn().mockResolvedValue({ ...baseMessage, status: 'SENT', sentAt: new Date() }),
          },
          messageRecipient: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        }),
      )
      EmailNotificationService.sendGenericEmail.mockResolvedValue(undefined)
    })

    it('quota esaurita → 429 con messaggio chiaro, niente transaction né fan-out', async () => {
      prisma.message.findFirst.mockResolvedValue({ ...baseMessage })
      rateLimitByKey.mockResolvedValue(false)

      const response = await sendMessage(createRequest(), routeParams)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBeTruthy()
      expect(rateLimitByKey).toHaveBeenCalledWith('tenant-1', 200, 3600000, 'rl:queue:msgsend')
      // Il messaggio NON deve essere marcato SENT né l'email accodata
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(EmailNotificationService.sendGenericEmail).not.toHaveBeenCalled()
    })

    it('quota ok → invio normale con fan-out email', async () => {
      prisma.message.findFirst.mockResolvedValue({ ...baseMessage })

      const response = await sendMessage(createRequest(), routeParams)

      expect(response.status).toBe(200)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(EmailNotificationService.sendGenericEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: ['a@test.it', 'c@test.it'] }),
      )
    })

    it('messaggio già inviato → 400 senza consumare quota', async () => {
      prisma.message.findFirst.mockResolvedValue({ ...baseMessage, status: 'SENT' })

      const response = await sendMessage(createRequest(), routeParams)

      expect(response.status).toBe(400)
      expect(rateLimitByKey).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
