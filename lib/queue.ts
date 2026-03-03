import { Queue, Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';

// Queue definitions
export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface PDFJobData {
  templateName: string;
  data: any;
  outputPath?: string;
  tenantId: string;
}

export interface NotificationJobData {
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: any;
}

// Lazy queue initialization
let _emailQueue: Queue | null = null;
let _pdfQueue: Queue | null = null;
let _notificationQueue: Queue | null = null;

function getEmailQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!_emailQueue) {
    _emailQueue = new Queue('email', {
      connection: redis.getConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }
  return _emailQueue;
}

function getPdfQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!_pdfQueue) {
    _pdfQueue = new Queue('pdf', {
      connection: redis.getConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    });
  }
  return _pdfQueue;
}

function getNotificationQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!_notificationQueue) {
    _notificationQueue = new Queue('notification', {
      connection: redis.getConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 20,
        attempts: 2,
      },
    });
  }
  return _notificationQueue;
}

// Export queues with getters for lazy initialization
export const emailQueue = { get: getEmailQueue };
export const pdfQueue = { get: getPdfQueue };
export const notificationQueue = { get: getNotificationQueue };

// BUG-044 fix: Throw error instead of returning null when queue is unavailable
export class QueueUnavailableError extends Error {
  constructor(queueName: string) {
    super(`${queueName} queue not available. Redis connection required.`);
    this.name = 'QueueUnavailableError';
  }
}

// Queue utilities
export const queueManager = {
  async addEmailJob(data: EmailJobData, options?: any) {
    const queue = getEmailQueue();
    if (!queue) {
      throw new QueueUnavailableError('Email');
    }
    return await queue.add('send-email', data, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
      ...options,
    });
  },

  async addPDFJob(data: PDFJobData, options?: any) {
    const queue = getPdfQueue();
    if (!queue) {
      throw new QueueUnavailableError('PDF');
    }
    return await queue.add('generate-pdf', data, {
      priority: options?.priority || 0,
      ...options,
    });
  },

  async addNotificationJob(data: NotificationJobData, options?: any) {
    const queue = getNotificationQueue();
    if (!queue) {
      throw new QueueUnavailableError('Notification');
    }
    return await queue.add('send-notification', data, {
      priority: options?.priority || 0,
      ...options,
    });
  },

  async getQueueStats() {
    const email = getEmailQueue();
    const pdf = getPdfQueue();
    const notification = getNotificationQueue();

    const [emailStats, pdfStats, notificationStats] = await Promise.all([
      email?.getJobCounts() || { waiting: 0, active: 0, completed: 0, failed: 0 },
      pdf?.getJobCounts() || { waiting: 0, active: 0, completed: 0, failed: 0 },
      notification?.getJobCounts() || { waiting: 0, active: 0, completed: 0, failed: 0 },
    ]);

    return {
      email: emailStats,
      pdf: pdfStats,
      notification: notificationStats,
    };
  },

  async pauseQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.pause();
    }
  },

  async resumeQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.resume();
    }
  },

  getQueue(name: string) {
    switch (name) {
      case 'email':
        return getEmailQueue();
      case 'pdf':
        return getPdfQueue();
      case 'notification':
        return getNotificationQueue();
      default:
        return null;
    }
  },
};

// Worker event handlers
export function setupWorkerEventHandlers(worker: Worker) {
  worker.on('completed', (job: Job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('progress', (job: Job, progress: any) => {
    console.log(`🔄 Job ${job.id} progress: ${JSON.stringify(progress)}`);
  });

  worker.on('error', (err: Error) => {
    console.error('❌ Worker error:', err);
  });

  worker.on('ready', () => {
    console.log('✅ Worker ready');
  });

  worker.on('closing', () => {
    console.log('🔄 Worker closing...');
  });

  worker.on('closed', () => {
    console.log('✅ Worker closed');
  });
}

export default queueManager;
