import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import nodemailer from 'nodemailer';

// Email job types
export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface WelcomeEmailJobData extends EmailJobData {
  userName: string;
  loginUrl: string;
}

export interface AttendanceReportJobData extends EmailJobData {
  studentName: string;
  className: string;
  attendanceData: Array<{
    date: string;
    status: 'present' | 'absent' | 'late';
  }>;
}

export interface PaymentReminderJobData extends EmailJobData {
  studentName: string;
  parentName: string;
  amount: number;
  dueDate: string;
  invoiceUrl?: string;
}

// Job type enum
export enum EmailJobType {
  WELCOME = 'welcome',
  ATTENDANCE_REPORT = 'attendance-report',
  PAYMENT_REMINDER = 'payment-reminder',
  GENERIC = 'generic',
}

// Redis connection configuration
const redisConnection = redis.getConnectionConfig();

// Create email queue
export const emailQueue = new Queue('email', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    attempts: 3,
  },
});

// Email transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
};

// Email worker
export const emailWorker = new Worker(
  'email',
  async (job: Job<EmailJobData>) => {
    const { to, subject, html, text, attachments } = job.data;
    
    logger.info(`Processing email job ${job.id}: ${subject}`, { to, jobType: job.name });
    
    const transporter = createEmailTransporter();
    
    try {
      const result = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@insegnami.pro',
        to,
        subject,
        html,
        text,
        attachments,
      });
      
      logger.info(`Email sent successfully for job ${job.id}`, { 
        messageId: result.messageId,
        to,
        subject 
      });
      
      return { messageId: result.messageId, status: 'sent' };
    } catch (error) {
      logger.error(`Failed to send email for job ${job.id}`, error, { to, subject });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Queue events for monitoring
export const emailQueueEvents = new QueueEvents('email', {
  connection: redisConnection,
});

// Event listeners
emailWorker.on('completed', (job: Job, result: any) => {
  logger.info(`Email job ${job.id} completed`, { result });
});

emailWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Email job ${job?.id} failed`, err, { jobData: job?.data });
});

emailQueueEvents.on('waiting', ({ jobId }) => {
  logger.debug(`Email job ${jobId} is waiting`);
});

emailQueueEvents.on('active', ({ jobId }) => {
  logger.debug(`Email job ${jobId} is active`);
});

// Email notification helpers
export class EmailNotificationService {
  static async sendWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    const html = `
      <h1>Welcome to InsegnaMi.pro!</h1>
      <p>Hello ${data.userName},</p>
      <p>Your account has been created successfully.</p>
      <p>You can login at: <a href="${data.loginUrl}">${data.loginUrl}</a></p>
      <p>Best regards,<br>The InsegnaMi.pro Team</p>
    `;
    
    await emailQueue.add(EmailJobType.WELCOME, {
      ...data,
      html: data.html || html,
      text: data.text || `Welcome to InsegnaMi.pro! Login at: ${data.loginUrl}`,
    });
  }

  static async sendAttendanceReport(data: AttendanceReportJobData): Promise<void> {
    const attendanceTable = data.attendanceData.map(record => 
      `<tr><td>${record.date}</td><td>${record.status}</td></tr>`
    ).join('');
    
    const html = `
      <h1>Attendance Report</h1>
      <p>Student: ${data.studentName}</p>
      <p>Class: ${data.className}</p>
      <table border="1" style="border-collapse: collapse;">
        <thead>
          <tr><th>Date</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${attendanceTable}
        </tbody>
      </table>
    `;
    
    await emailQueue.add(EmailJobType.ATTENDANCE_REPORT, {
      ...data,
      html: data.html || html,
    });
  }

  static async sendPaymentReminder(data: PaymentReminderJobData): Promise<void> {
    const html = `
      <h1>Payment Reminder</h1>
      <p>Dear ${data.parentName},</p>
      <p>This is a reminder that payment for ${data.studentName} is due.</p>
      <p>Amount: €${data.amount}</p>
      <p>Due Date: ${data.dueDate}</p>
      ${data.invoiceUrl ? `<p><a href="${data.invoiceUrl}">View Invoice</a></p>` : ''}
      <p>Please make the payment as soon as possible.</p>
      <p>Best regards,<br>InsegnaMi.pro Administration</p>
    `;
    
    await emailQueue.add(EmailJobType.PAYMENT_REMINDER, {
      ...data,
      html: data.html || html,
    });
  }

  static async sendGenericEmail(data: EmailJobData): Promise<void> {
    await emailQueue.add(EmailJobType.GENERIC, data);
  }
}

// Queue monitoring utilities
export class EmailQueueMonitor {
  static async getQueueStats() {
    const waiting = await emailQueue.getWaiting();
    const active = await emailQueue.getActive();
    const completed = await emailQueue.getCompleted();
    const failed = await emailQueue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
  
  static async getFailedJobs() {
    return await emailQueue.getFailed();
  }
  
  static async retryFailedJobs() {
    const failedJobs = await this.getFailedJobs();
    const retryPromises = failedJobs.map(job => job.retry());
    await Promise.all(retryPromises);
    logger.info(`Retried ${failedJobs.length} failed email jobs`);
  }
  
  static async cleanOldJobs() {
    await emailQueue.clean(24 * 60 * 60 * 1000, 10, 'completed'); // Keep 10 completed jobs from last 24h
    await emailQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'); // Keep 50 failed jobs from last 7 days
    logger.info('Cleaned old email queue jobs');
  }
}

// Graceful shutdown
export async function shutdownEmailQueue() {
  logger.info('Shutting down email queue...');
  await emailWorker.close();
  await emailQueue.close();
  await emailQueueEvents.close();
  logger.info('Email queue shutdown complete');
}
