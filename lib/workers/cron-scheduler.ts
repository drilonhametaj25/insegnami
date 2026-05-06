import { Queue, Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { AutomationService } from '@/lib/automation-service';

/**
 * Cron jobs are modelled as BullMQ repeatable jobs in a dedicated queue.
 * The advantage over node-cron / OS cron is that jobs survive restarts,
 * the schedule is stored in Redis, and we get retries + observability for free.
 */

export type CronJobName =
  | 'daily-automation'
  | 'mark-payments-overdue'
  | 'parent-attendance-digest';

let _cronQueue: Queue | null = null;

function getCronQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!_cronQueue) {
    _cronQueue = new Queue('cron', {
      connection: redis.getConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    });
  }
  return _cronQueue;
}

export const cronQueue = { get: getCronQueue };

/**
 * AutomationRun audit-trail wrapper. Records start/finish/error per cron run.
 * If the AutomationRun model doesn't exist yet (migration pending) the run
 * still executes — only the bookkeeping is skipped.
 */
async function withAuditRun<T>(
  jobName: CronJobName,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  let runId: string | null = null;

  try {
    const created = await (prisma as any).automationRun?.create({
      data: { jobName, startedAt, status: 'RUNNING' },
      select: { id: true },
    });
    runId = created?.id ?? null;
  } catch {
    // model missing or transient DB issue — proceed without bookkeeping
  }

  try {
    const result = await fn();
    if (runId) {
      try {
        await (prisma as any).automationRun?.update({
          where: { id: runId },
          data: { finishedAt: new Date(), status: 'SUCCESS', resultJson: result ?? undefined },
        });
      } catch {/* swallow */}
    }
    return result;
  } catch (err) {
    if (runId) {
      try {
        await (prisma as any).automationRun?.update({
          where: { id: runId },
          data: {
            finishedAt: new Date(),
            status: 'FAILED',
            error: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
          },
        });
      } catch {/* swallow */}
    }
    throw err;
  }
}

/**
 * Mark every PENDING payment whose dueDate is strictly before today as OVERDUE.
 * Idempotent — running twice in the same day produces zero changes the second
 * time. Returns the number of rows updated.
 */
export async function markPaymentsOverdue(): Promise<{ updated: number }> {
  const now = new Date();
  const result = await prisma.payment.updateMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });
  logger.info(`markPaymentsOverdue: ${result.count} payments transitioned PENDING → OVERDUE`);
  return { updated: result.count };
}

/**
 * Email a digest of yesterday's absences to parents. Stub for now — the
 * actual notification fan-out reuses AutomationService.schedulePaymentReminder
 * style. Implementing this fully requires Notification preferences UI which
 * is in Wave 2.
 */
export async function parentAttendanceDigest(): Promise<{ pendingDigests: number }> {
  // Placeholder counter — the dispatcher will be filled in Wave 2.8.
  // Returning a structured result so the AutomationRun row carries something.
  return { pendingDigests: 0 };
}

/**
 * Process cron jobs as they fire. The processor itself is short — most work
 * lives in dedicated services (AutomationService.runDailyAutomation etc).
 */
async function cronProcessor(job: Job): Promise<unknown> {
  const name = job.name as CronJobName;
  switch (name) {
    case 'daily-automation':
      return withAuditRun(name, () => AutomationService.runDailyAutomation());
    case 'mark-payments-overdue':
      return withAuditRun(name, () => markPaymentsOverdue());
    case 'parent-attendance-digest':
      return withAuditRun(name, () => parentAttendanceDigest());
    default:
      logger.warn(`Unknown cron job: ${name}`);
      return null;
  }
}

let _cronWorker: Worker | null = null;
export function getCronWorker(): Worker | null {
  if (!process.env.REDIS_URL) return null;
  if (_cronWorker) return _cronWorker;
  _cronWorker = new Worker('cron', cronProcessor, {
    connection: redis.getConnectionConfig(),
    concurrency: 1, // cron jobs are coarse and DB-heavy — serialize them
  });
  _cronWorker.on('failed', (job, err) => {
    logger.error(`Cron ${job?.name} failed`, err);
  });
  return _cronWorker;
}

/**
 * Idempotently register all repeatable jobs. Safe to call on every worker
 * boot — BullMQ deduplicates by repeat options.
 *
 * Times use Europe/Rome (the operational timezone for the school year).
 * BullMQ supports the `tz` option natively.
 */
export async function registerCronJobs(): Promise<void> {
  const queue = getCronQueue();
  if (!queue) {
    logger.warn('Cron queue unavailable (no REDIS_URL); skipping cron registration');
    return;
  }

  const tz = 'Europe/Rome';
  const schedules: Array<{ name: CronJobName; cron: string }> = [
    { name: 'mark-payments-overdue', cron: '0 6 * * *' },   // daily 06:00
    { name: 'daily-automation',       cron: '0 2 * * *' },   // daily 02:00 (lessons + payment reminders)
    { name: 'parent-attendance-digest', cron: '0 9 * * *' }, // daily 09:00
  ];

  for (const s of schedules) {
    await queue.add(s.name, {}, {
      repeat: { pattern: s.cron, tz },
      jobId: `cron:${s.name}`, // stable id prevents duplicate scheduling
    });
    logger.info(`Cron registered: ${s.name} (${s.cron} ${tz})`);
  }
}

/**
 * Run a cron job immediately (skipping schedule). Used by:
 *  - admin "trigger now" buttons
 *  - tests
 *  - scripts/run-cron-job.ts
 */
export async function triggerCronJob(name: CronJobName): Promise<void> {
  const queue = getCronQueue();
  if (!queue) throw new Error('Cron queue unavailable');
  await queue.add(name, { manual: true }, { jobId: `manual:${name}:${Date.now()}` });
}
