import { Queue } from 'bullmq';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

// Define job types
export interface AttendanceReminderJob {
  type: 'attendance-reminder';
  tenantId: string;
  lessonId: string;
  teacherId: string;
  reminderTime: 'before-class' | 'after-class' | 'end-of-day';
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

export interface RecurringLessonJob {
  type: 'recurring-lesson';
  tenantId: string;
  templateLessonId: string;
  nextDate: Date;
  patternEnd?: Date;
}

export type AutomationJob = 
  | AttendanceReminderJob 
  | PaymentReminderJob 
  | ClassCapacityWarningJob 
  | AutoEnrollmentJob
  | RecurringLessonJob;

// Create automation queue
export const automationQueue = new Queue<AutomationJob>('automation', {
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

// Automation service class
export class AutomationService {
  /**
   * Schedule attendance reminder
   */
  static async scheduleAttendanceReminder(
    lessonId: string,
    reminderTime: 'before-class' | 'after-class' | 'end-of-day',
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

      const job: AttendanceReminderJob = {
        type: 'attendance-reminder',
        tenantId: lesson.tenantId,
        lessonId: lesson.id,
        teacherId: lesson.teacherId,
        reminderTime,
      };

      await automationQueue.add(job.type, job, {
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

      const job: PaymentReminderJob = {
        type: 'payment-reminder',
        tenantId: payment.tenantId,
        studentId: payment.studentId,
        paymentId: payment.id,
        reminderType,
      };

      await automationQueue.add(job.type, job, {
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
        const job: ClassCapacityWarningJob = {
          type: 'class-capacity-warning',
          tenantId: classData.tenantId,
          classId: classData.id,
          currentCapacity,
          maxCapacity,
        };

        await automationQueue.add(job.type, job, {
          jobId: `capacity-${classId}`,
        });
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
   * Generate recurring lessons
   */
  static async generateRecurringLesson(templateLessonId: string, nextDate: Date) {
    try {
      const templateLesson = await prisma.lesson.findUnique({
        where: { id: templateLessonId },
      });

      if (!templateLesson || !templateLesson.isRecurring) return;

      const duration = new Date(templateLesson.endTime).getTime() - 
                      new Date(templateLesson.startTime).getTime();

      // Create new lesson based on template
      const newLesson = await prisma.lesson.create({
        data: {
          title: templateLesson.title,
          description: templateLesson.description,
          startTime: nextDate,
          endTime: new Date(nextDate.getTime() + duration),
          room: templateLesson.room,
          status: 'SCHEDULED',
          tenantId: templateLesson.tenantId,
          classId: templateLesson.classId,
          teacherId: templateLesson.teacherId,
          isRecurring: true,
          recurrenceRule: templateLesson.recurrenceRule,
          parentLessonId: templateLesson.parentLessonId || templateLessonId,
        },
      });

      // Calculate next occurrence based on recurrence rule
      // This would need a proper RRULE parser like 'rrule' package
      const nextOccurrence = this.calculateNextOccurrenceFromRule(
        nextDate, 
        templateLesson.recurrenceRule
      );
      
      if (nextOccurrence) {
        const job: RecurringLessonJob = {
          type: 'recurring-lesson',
          tenantId: templateLesson.tenantId,
          templateLessonId: templateLesson.parentLessonId || templateLessonId,
          nextDate: nextOccurrence,
        };

        await automationQueue.add(job.type, job, {
          delay: nextOccurrence.getTime() - Date.now(),
          jobId: `recurring-${templateLessonId}-${nextOccurrence.getTime()}`,
        });
      }

      logger.info(`Created recurring lesson ${newLesson.id} for ${nextDate}`);
      return newLesson;
    } catch (error) {
      logger.error('Failed to generate recurring lesson', error);
    }
  }

  /**
   * Calculate next occurrence from RRULE string
   * This is a simplified version - in production use 'rrule' package
   */
  private static calculateNextOccurrenceFromRule(currentDate: Date, rrule: string | null): Date | null {
    if (!rrule) return null;

    // Simple parsing for basic rules
    // Format: "FREQ=WEEKLY;INTERVAL=1" or "FREQ=DAILY;INTERVAL=1"
    const nextDate = new Date(currentDate);
    
    if (rrule.includes('FREQ=WEEKLY')) {
      const interval = rrule.includes('INTERVAL=') ? 
        parseInt(rrule.split('INTERVAL=')[1].split(';')[0]) : 1;
      nextDate.setDate(nextDate.getDate() + 7 * interval);
    } else if (rrule.includes('FREQ=DAILY')) {
      const interval = rrule.includes('INTERVAL=') ? 
        parseInt(rrule.split('INTERVAL=')[1].split(';')[0]) : 1;
      nextDate.setDate(nextDate.getDate() + interval);
    } else {
      return null;
    }

    return nextDate;
  }

  /**
   * Calculate next occurrence based on pattern (legacy method)
   */
  private static calculateNextOccurrence(currentDate: Date, pattern: any): Date | null {
    const nextDate = new Date(currentDate);

    switch (pattern.frequency) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + (pattern.interval || 1));
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7 * (pattern.interval || 1));
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + (pattern.interval || 1));
        break;
      case 'YEARLY':
        nextDate.setFullYear(nextDate.getFullYear() + (pattern.interval || 1));
        break;
      default:
        return null;
    }

    return nextDate;
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
      logger.error('Failed to setup daily reminders', error);
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

      // Overdue payments (7 days past due)
      const overduePayments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            gte: sevenDaysAgo,
            lt: now,
          },
        },
      });

      // Final notice (30 days past due)
      const finalNoticePayments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
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
      logger.error('Failed to setup payment reminders', error);
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
      logger.error('Daily automation routine failed', error);
    }
  }
}
