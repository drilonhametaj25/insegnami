import { Queue } from 'bullmq';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitByKey } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

// B3.4: quota per-tenant anti-DoS sull'enqueue dei job automation —
// max job/ora per tenant. Sliding window su Redis, fail-open se Redis giù.
const AUTOMATION_QUEUE_MAX_PER_HOUR = 1000;
const AUTOMATION_QUEUE_WINDOW_MS = 3600000;

/**
 * Verifica la quota oraria di enqueue per il tenant. Ritorna true se il job
 * può essere accodato; false (con warn) se la quota è esaurita.
 */
async function checkAutomationQuota(tenantId: string, jobLabel: string): Promise<boolean> {
  const allowed = await rateLimitByKey(
    tenantId,
    AUTOMATION_QUEUE_MAX_PER_HOUR,
    AUTOMATION_QUEUE_WINDOW_MS,
    'rl:queue:automation',
  );
  if (!allowed) {
    logger.warn(
      `Automation quota esaurita per tenant ${tenantId}: job ${jobLabel} non accodato`,
    );
  }
  return allowed;
}

// Define job types
// NB: il tipo 'end-of-day' (mai implementato) è stato rimosso.
export interface AttendanceReminderJob {
  type: 'attendance-reminder';
  tenantId: string;
  lessonId: string;
  teacherId: string;
  reminderTime: 'before-class' | 'after-class';
}

export interface PaymentReminderJob {
  type: 'payment-reminder';
  tenantId: string;
  studentId: string;
  paymentId: string;
  reminderType: 'due-soon' | 'overdue' | 'final-notice';
}

export interface ClassCapacityWarningJob {
  type: 'class-capacity-warning';
  tenantId: string;
  classId: string;
  currentCapacity: number;
  maxCapacity: number;
}

export interface AutoEnrollmentJob {
  type: 'auto-enrollment';
  tenantId: string;
  studentId: string;
  waitingListId: string;
  classId: string;
}

// Ricorrenze deprecate: la generazione delle lezioni ricorrenti è ora eager
// nell'endpoint dedicato (app/api/lessons/recurring) — niente più job in coda.
export type AutomationJob =
  | AttendanceReminderJob
  | PaymentReminderJob
  | ClassCapacityWarningJob
  | AutoEnrollmentJob;

// Lazy initialization for automation queue
let _automationQueue: Queue<AutomationJob> | null = null;

function getAutomationQueue(): Queue<AutomationJob> | null {
  if (!process.env.REDIS_URL) {
    // During build or when Redis is not configured
    return null;
  }

  if (!_automationQueue) {
    _automationQueue = new Queue<AutomationJob>('automation', {
      connection: redis.getConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }
  return _automationQueue;
}

// Export getter for queue
export const automationQueue = { get: getAutomationQueue };

// Automation service class
export class AutomationService {
  /**
   * Schedule attendance reminder
   */
  static async scheduleAttendanceReminder(
    lessonId: string,
    reminderTime: 'before-class' | 'after-class',
    delay: number = 0
  ) {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          teacher: true,
          class: {
            include: {
              students: {
                include: {
                  student: true,
                },
              },
            },
          },
        },
      });

      if (!lesson) {
        logger.error(`Lesson not found: ${lessonId}`);
        return;
      }

      // B3.4: quota per-tenant prima dell'enqueue
      if (!(await checkAutomationQuota(lesson.tenantId, `attendance-${lessonId}-${reminderTime}`))) {
        return;
      }

      const job: AttendanceReminderJob = {
        type: 'attendance-reminder',
        tenantId: lesson.tenantId,
        lessonId: lesson.id,
        teacherId: lesson.teacherId,
        reminderTime,
      };

      const queue = automationQueue.get();
      if (!queue) {
        logger.warn('Automation queue not available');
        return;
      }
      await queue.add(job.type, job, {
        delay,
        jobId: `attendance-${lessonId}-${reminderTime}`,
      });

      logger.info(`Attendance reminder scheduled for lesson ${lessonId}`);
    } catch (error) {
      logger.error('Failed to schedule attendance reminder', error);
    }
  }

  /**
   * Schedule payment reminder
   */
  static async schedulePaymentReminder(
    paymentId: string,
    reminderType: 'due-soon' | 'overdue' | 'final-notice',
    delay: number = 0
  ) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          student: true,
        },
      });

      if (!payment) {
        logger.error(`Payment not found: ${paymentId}`);
        return;
      }

      // B3.4: quota per-tenant prima dell'enqueue
      if (!(await checkAutomationQuota(payment.tenantId, `payment-${paymentId}-${reminderType}`))) {
        return;
      }

      const job: PaymentReminderJob = {
        type: 'payment-reminder',
        tenantId: payment.tenantId,
        studentId: payment.studentId,
        paymentId: payment.id,
        reminderType,
      };

      const queue = automationQueue.get();
      if (!queue) {
        logger.warn('Automation queue not available');
        return;
      }
      await queue.add(job.type, job, {
        delay,
        jobId: `payment-${paymentId}-${reminderType}`,
      });

      logger.info(`Payment reminder scheduled for payment ${paymentId}`);
    } catch (error) {
      logger.error('Failed to schedule payment reminder', error);
    }
  }

  /**
   * Check and warn about class capacity
   */
  static async checkClassCapacity(classId: string) {
    try {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          students: true,
        },
      });

      if (!classData) return;

      const currentCapacity = classData.students.length;
      const maxCapacity = classData.maxStudents;
      const capacityPercentage = (currentCapacity / maxCapacity) * 100;

      // Warn when class is 90% full
      if (capacityPercentage >= 90) {
        // B3.4: quota per-tenant prima dell'enqueue
        if (!(await checkAutomationQuota(classData.tenantId, `capacity-${classId}`))) {
          return;
        }

        const job: ClassCapacityWarningJob = {
          type: 'class-capacity-warning',
          tenantId: classData.tenantId,
          classId: classData.id,
          currentCapacity,
          maxCapacity,
        };

        const queue = automationQueue.get();
        if (queue) {
          await queue.add(job.type, job, {
            jobId: `capacity-${classId}`,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check class capacity', error);
    }
  }

  /**
   * Process automatic enrollment from waiting list
   */
  static async processAutoEnrollment(classId: string) {
    try {
      // Check if class has available spots
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          students: true,
          // Add waiting list when implemented
        },
      });

      if (!classData) return;

      const availableSpots = classData.maxStudents - classData.students.length;
      
      if (availableSpots > 0) {
        // Get students from waiting list (to be implemented)
        // For now, just log the availability
        logger.info(`Class ${classId} has ${availableSpots} available spots`);
      }
    } catch (error) {
      logger.error('Failed to process auto enrollment', error);
    }
  }

  /**
   * Setup automatic reminders for today's lessons
   */
  static async setupDailyReminders() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const todaysLessons = await prisma.lesson.findMany({
        where: {
          startTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: 'SCHEDULED',
        },
        include: {
          teacher: true,
          class: true,
        },
      });

      for (const lesson of todaysLessons) {
        const lessonStart = new Date(lesson.startTime);
        const lessonEnd = new Date(lesson.endTime);
        const now = new Date();

        // Schedule before-class reminder (30 minutes before)
        const beforeClassTime = new Date(lessonStart.getTime() - 30 * 60 * 1000);
        if (beforeClassTime > now) {
          await this.scheduleAttendanceReminder(
            lesson.id,
            'before-class',
            beforeClassTime.getTime() - now.getTime()
          );
        }

        // Schedule after-class reminder (15 minutes after lesson ends)
        const afterClassTime = new Date(lessonEnd.getTime() + 15 * 60 * 1000);
        if (afterClassTime > now) {
          await this.scheduleAttendanceReminder(
            lesson.id,
            'after-class',
            afterClassTime.getTime() - now.getTime()
          );
        }
      }

      logger.info(`Setup daily reminders for ${todaysLessons.length} lessons`);
    } catch (error) {
      // Logga E rilancia: l'errore deve emergere fino ad AutomationRun (FAILED)
      logger.error('Failed to setup daily reminders', error);
      throw error;
    }
  }

  /**
   * Setup payment due reminders
   */
  static async setupPaymentReminders() {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Payments due soon (within 3 days)
      const dueSoonPayments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            gte: now,
            lte: threeDaysFromNow,
          },
        },
      });

      // Overdue payments (7 days past due). Il cron mark-payments-overdue
      // ha già spostato i PENDING scaduti a OVERDUE: la query li include
      // entrambi per non perdere solleciti se il cron non è ancora girato.
      const overduePayments = await prisma.payment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: {
            gte: sevenDaysAgo,
            lt: now,
          },
        },
      });

      // Final notice (30 days past due)
      const finalNoticePayments = await prisma.payment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: {
            gte: thirtyDaysAgo,
            lt: sevenDaysAgo,
          },
        },
      });

      // Schedule reminders
      for (const payment of dueSoonPayments) {
        await this.schedulePaymentReminder(payment.id, 'due-soon');
      }

      for (const payment of overduePayments) {
        await this.schedulePaymentReminder(payment.id, 'overdue');
      }

      for (const payment of finalNoticePayments) {
        await this.schedulePaymentReminder(payment.id, 'final-notice');
      }

      logger.info(
        `Setup payment reminders: ${dueSoonPayments.length} due soon, ` +
        `${overduePayments.length} overdue, ${finalNoticePayments.length} final notice`
      );
    } catch (error) {
      // Logga E rilancia: l'errore deve emergere fino ad AutomationRun (FAILED)
      logger.error('Failed to setup payment reminders', error);
      throw error;
    }
  }

  /**
   * Daily automation routine - called by cron job
   */
  static async runDailyAutomation() {
    logger.info('Starting daily automation routine');

    try {
      await Promise.all([
        this.setupDailyReminders(),
        this.setupPaymentReminders(),
        // Add other daily automations here
      ]);

      logger.info('Daily automation routine completed successfully');
    } catch (error) {
      // Niente catch inghiottito: il chiamante (withAuditRun) deve vedere
      // il fallimento e marcare la run FAILED.
      logger.error('Daily automation routine failed', error);
      throw error;
    }
  }
}
