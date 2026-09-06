import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';

// Metadati opzionali per il registro EmailLog: chi accoda può passare il
// tenant e la sorgente (es. 'payment-reminder' + id) oppure l'id di una riga
// EmailLog già creata (QUEUED) che il worker deve flippare a SENT/FAILED.
export interface EmailJobMeta {
  emailLogId?: string;
  tenantId?: string;
  sourceType?: string;
  sourceId?: string;
}

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
  meta?: EmailJobMeta;
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

// ============================================================================
// PRODUCER (lato Next: le route accodano soltanto)
// La Queue è lazy: niente connessioni Redis al semplice import del modulo.
// ============================================================================

let _emailQueue: Queue | null = null;

export function getEmailQueue(): Queue | null {
  // Guardia REDIS_URL (come cron/automation queue): senza Redis configurato
  // la coda non esiste — i chiamanti gestiscono il null (fallback SMTP).
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!_emailQueue) {
    _emailQueue = new Queue('email', {
      connection: redis.getConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        // BUG-025 fix: Increased retry attempts from 3 to 10 for better reliability
        attempts: 10,
      },
    });
  }
  return _emailQueue;
}

// Retrocompatibilità: storicamente il modulo esportava l'istanza creata a
// module load. Il Proxy mantiene la stessa API ma istanzia la Queue solo
// al primo accesso reale; senza REDIS_URL lancia un errore esplicito che i
// chiamanti (dispatcher, EmailService) intercettano per il fallback SMTP.
export const emailQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const queue = getEmailQueue();
    if (!queue) {
      throw new Error('Email queue unavailable: REDIS_URL not configured');
    }
    const value = (queue as any)[prop];
    return typeof value === 'function' ? value.bind(queue) : value;
  },
});

// ============================================================================
// CONSUMER (solo processo worker dedicato: scripts/start-workers.ts)
// Worker, QueueEvents e transporter SMTP vengono creati esclusivamente
// dalla factory createEmailWorker() — mai al caricamento del modulo.
// ============================================================================

// Transporter del worker: UNO solo, in pooling, riusato da tutti i job.
const createWorkerTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '587');
  return nodemailer.createTransport({
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    host: process.env.SMTP_HOST || 'localhost',
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

let _emailWorker: Worker | null = null;
let _emailQueueEvents: QueueEvents | null = null;
let _workerTransporter: nodemailer.Transporter | null = null;

/**
 * Scrittura best-effort del registro EmailLog dal worker: aggiorna la riga
 * QUEUED indicata da meta.emailLogId, oppure ne crea una nuova con lo stato
 * finale. Non lancia mai (il bookkeeping non deve rompere il job).
 */
async function writeWorkerEmailLog(
  data: EmailJobData,
  status: 'SENT' | 'FAILED',
  messageId: string | null,
  error: string | null,
): Promise<void> {
  try {
    const sentAt = status === 'SENT' ? new Date() : null;
    if (data.meta?.emailLogId) {
      await prisma.emailLog.update({
        where: { id: data.meta.emailLogId },
        data: { status, messageId, sentAt, error },
      });
    } else {
      await prisma.emailLog.create({
        data: {
          tenantId: data.meta?.tenantId ?? null,
          to: Array.isArray(data.to) ? data.to.join(',') : data.to,
          subject: data.subject,
          sourceType: data.meta?.sourceType ?? null,
          sourceId: data.meta?.sourceId ?? null,
          status,
          messageId,
          sentAt,
          error,
        },
      });
    }
  } catch (err) {
    logger.warn('EmailLog bookkeeping failed in email worker', err);
  }
}

/**
 * Factory del consumer email (pattern getCronWorker). Idempotente: la
 * seconda chiamata ritorna la stessa istanza. Da invocare SOLO dal processo
 * worker — il processo Next non deve mai consumare la coda.
 */
export function createEmailWorker(): Worker {
  if (_emailWorker) return _emailWorker;

  // Creato una volta per processo; chiuso in shutdownEmailQueue()
  if (!_workerTransporter) {
    _workerTransporter = createWorkerTransporter();
  }

  _emailWorker = new Worker(
    'email',
    async (job: Job<EmailJobData>) => {
      const { to, subject, html, text, attachments, meta } = job.data;

      logger.info(`Processing email job ${job.id}: ${subject}`, { to, jobType: job.name });

      try {
        const result = await _workerTransporter!.sendMail({
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
          subject,
        });

        // Registro EmailLog: QUEUED→SENT (o riga nuova SENT se il producer
        // non ne aveva creata una). Best-effort: un problema di bookkeeping
        // non deve far fallire un invio riuscito.
        await writeWorkerEmailLog(job.data, 'SENT', result.messageId ?? null, null);

        return { messageId: result.messageId, status: 'sent' };
      } catch (error) {
        logger.error(`Failed to send email for job ${job.id}`, error, { to, subject });
        // FAILED solo sull'ultimo tentativo (i retry intermedi non sporcano
        // il registro), oppure sempre se c'è una riga QUEUED da flippare.
        const attempts = (job.opts?.attempts as number | undefined) ?? 1;
        const isLastAttempt = job.attemptsMade + 1 >= attempts;
        if (meta?.emailLogId || isLastAttempt) {
          await writeWorkerEmailLog(
            job.data,
            'FAILED',
            null,
            error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
          );
        }
        throw error;
      }
    },
    {
      connection: redis.getConnectionConfig(),
      concurrency: 5,
    }
  );

  // Event listeners di osservabilità
  _emailWorker.on('completed', (job: Job, result: any) => {
    logger.info(`Email job ${job.id} completed`, { result });
  });

  _emailWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error(`Email job ${job?.id} failed`, err, { jobData: job?.data });
  });

  _emailQueueEvents = new QueueEvents('email', {
    connection: redis.getConnectionConfig(),
  });

  _emailQueueEvents.on('waiting', ({ jobId }) => {
    logger.debug(`Email job ${jobId} is waiting`);
  });

  _emailQueueEvents.on('active', ({ jobId }) => {
    logger.debug(`Email job ${jobId} is active`);
  });

  return _emailWorker;
}

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

  static async sendGenericEmail(data: EmailJobData, opts?: { delay?: number }): Promise<void> {
    // delay: "non prima di" (quiet hours / scheduledFor) via delayed job BullMQ
    if (opts?.delay && opts.delay > 0) {
      await emailQueue.add(EmailJobType.GENERIC, data, { delay: opts.delay });
    } else {
      await emailQueue.add(EmailJobType.GENERIC, data);
    }
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

// Graceful shutdown: chiude solo ciò che è stato effettivamente creato
// (il processo Next ha al massimo la Queue producer; il worker ha tutto).
export async function shutdownEmailQueue() {
  logger.info('Shutting down email queue...');
  if (_emailWorker) {
    await _emailWorker.close();
    _emailWorker = null;
  }
  if (_emailQueueEvents) {
    await _emailQueueEvents.close();
    _emailQueueEvents = null;
  }
  if (_workerTransporter) {
    _workerTransporter.close();
    _workerTransporter = null;
  }
  if (_emailQueue) {
    await _emailQueue.close();
    _emailQueue = null;
  }
  logger.info('Email queue shutdown complete');
}
