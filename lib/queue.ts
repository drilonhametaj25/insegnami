import { Queue, Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { WORKER_CONFIG } from '@/lib/config';

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

// Create queues
export const emailQueue = new Queue('email', {
  connection: redis.getClient(),
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

export const pdfQueue = new Queue('pdf', {
  connection: redis.getClient(),
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

export const notificationQueue = new Queue('notification', {
  connection: redis.getClient(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 2,
  },
});

// Queue utilities
export const queueManager = {
  async addEmailJob(data: EmailJobData, options?: any) {
    return await emailQueue.add('send-email', data, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
      ...options,
    });
  },

  async addPDFJob(data: PDFJobData, options?: any) {
    return await pdfQueue.add('generate-pdf', data, {
      priority: options?.priority || 0,
      ...options,
    });
  },

  async addNotificationJob(data: NotificationJobData, options?: any) {
    return await notificationQueue.add('send-notification', data, {
      priority: options?.priority || 0,
      ...options,
    });
  },

  async getQueueStats() {
    const [emailStats, pdfStats, notificationStats] = await Promise.all([
      emailQueue.getJobCounts(),
      pdfQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
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
        return emailQueue;
      case 'pdf':
        return pdfQueue;
      case 'notification':
        return notificationQueue;
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
