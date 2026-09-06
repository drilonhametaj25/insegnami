import { Queue, Worker, Job } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { AutomationService } from '@/lib/automation-service';
import { notifyTenantAdmins } from '@/lib/notifications/billing-notifications';
import { createAndDispatch } from '@/lib/notifications/dispatcher';

/**
 * Cron jobs are modelled as BullMQ repeatable jobs in a dedicated queue.
 * The advantage over node-cron / OS cron is that jobs survive restarts,
 * the schedule is stored in Redis, and we get retries + observability for free.
 */

export type CronJobName =
  | 'daily-automation'
  | 'mark-payments-overdue'
  | 'parent-attendance-digest'
  | 'deactivate-expired-tenants'
  | 'auto-complete-lessons'
  | 'trial-ending-reminder'
  | 'cleanup-notifications'
  | 'retention-automation-runs'
  | 'email-queue-clean'
  | 'expire-stale-subscriptions'
  | 'reset-demo-tenant';

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
 * Wrapper di audit-trail AutomationRun: registra start/fine/errore per ogni
 * esecuzione cron. Il bookkeeping non deve mai bloccare il job: in caso di
 * problemi (DB transitorio, migrazione mancante) il job gira comunque, ma
 * l'errore viene LOGGATO (logger.warn) — niente catch silenziosi.
 */
export async function withAuditRun<T>(
  jobName: CronJobName,
  fn: () => Promise<T>,
  // Popolato quando il job è tenant-specifico: abilita la vista ADMIN
  // filtrata di GET /api/automation.
  tenantId?: string,
): Promise<T> {
  const startedAt = new Date();
  let runId: string | null = null;

  try {
    const created = await prisma.automationRun.create({
      data: { jobName, startedAt, status: 'RUNNING', tenantId: tenantId ?? null },
      select: { id: true },
    });
    runId = created?.id ?? null;
  } catch (err) {
    // Problema transitorio sul DB — il job procede senza bookkeeping
    logger.warn('AutomationRun bookkeeping failed', err);
  }

  try {
    const result = await fn();
    if (runId) {
      try {
        await prisma.automationRun.update({
          where: { id: runId },
          data: {
            finishedAt: new Date(),
            status: 'SUCCESS',
            resultJson: (result ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      } catch (err) {
        logger.warn('AutomationRun bookkeeping failed', err);
      }
    }
    return result;
  } catch (err) {
    if (runId) {
      try {
        await prisma.automationRun.update({
          where: { id: runId },
          data: {
            finishedAt: new Date(),
            status: 'FAILED',
            error: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
          },
        });
      } catch (bookkeepingErr) {
        logger.warn('AutomationRun bookkeeping failed', bookkeepingErr);
      }
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
 * Offset (ms) del fuso `timeZone` rispetto a UTC all'istante `date`.
 * Tecnica standard via Intl: formattiamo l'istante nel fuso target e
 * confrontiamo con l'epoch UTC corrispondente.
 */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second'),
  );
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Istante UTC corrispondente alla mezzanotte civile del giorno di `date`
 * nel fuso indicato. Robusto rispetto al cambio ora legale: la seconda
 * iterazione ricalcola l'offset valido proprio a mezzanotte.
 */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = dtf.format(date).split('-').map(Number);
  let ts = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    ts = Date.UTC(y, m - 1, d) - tzOffsetMs(new Date(ts), timeZone);
  }
  return new Date(ts);
}

/**
 * Digest giornaliero per i genitori: assenze e ritardi (ABSENT, LATE) del
 * GIORNO PRECEDENTE in Europe/Rome — finestra [ieri 00:00, oggi 00:00).
 * Una sola notifica per genitore (raggruppata su tutti i figli); gli studenti
 * senza account genitore collegato vengono saltati. Un errore di dispatch su
 * un genitore non blocca gli altri.
 */
export async function parentAttendanceDigest(): Promise<{
  pendingDigests: number;
  emailsEnqueued: number;
}> {
  const tz = 'Europe/Rome';
  const now = new Date();
  const todayStart = startOfDayInTimeZone(now, tz);
  // 1ms prima della mezzanotte di oggi cade sempre nel giorno civile precedente,
  // anche nei giorni da 23/25 ore (cambio ora legale)
  const yesterdayStart = startOfDayInTimeZone(new Date(todayStart.getTime() - 1), tz);

  const records = await prisma.attendance.findMany({
    where: {
      status: { in: ['ABSENT', 'LATE'] },
      lesson: { startTime: { gte: yesterdayStart, lt: todayStart } },
    },
    include: {
      student: { select: { firstName: true, lastName: true, parentUserId: true } },
      lesson: {
        select: {
          title: true,
          startTime: true,
          tenantId: true,
          class: { select: { name: true } },
        },
      },
    },
  });

  // Destinatari guardian-aware: StudentGuardian + fallback legacy parentUserId
  const digestStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
  const guardianLinks = digestStudentIds.length
    ? await prisma.studentGuardian.findMany({
        where: { studentId: { in: digestStudentIds } },
        select: { studentId: true, userId: true },
      })
    : [];
  const guardiansByStudent = new Map<string, Set<string>>();
  for (const link of guardianLinks) {
    const set = guardiansByStudent.get(link.studentId) ?? new Set<string>();
    set.add(link.userId);
    guardiansByStudent.set(link.studentId, set);
  }

  // Raggruppa per genitore — skip per chi non ha un account genitore collegato
  const byParent = new Map<string, typeof records>();
  for (const rec of records) {
    const recipientIds = new Set<string>(guardiansByStudent.get(rec.studentId) ?? []);
    if (rec.student.parentUserId) recipientIds.add(rec.student.parentUserId);
    for (const parentUserId of recipientIds) {
      const list = byParent.get(parentUserId) ?? [];
      list.push(rec);
      byParent.set(parentUserId, list);
    }
  }

  let emailsEnqueued = 0;
  for (const [parentUserId, items] of byParent) {
    const lines = items.map((r) => {
      const label = r.status === 'LATE' ? 'In ritardo' : 'Assente';
      const className = r.lesson.class?.name ?? 'Senza classe';
      return `${r.student.firstName} ${r.student.lastName} — ${r.lesson.title} (${className}) — ${label}`;
    });

    try {
      await createAndDispatch(
        {
          tenantId: items[0].lesson.tenantId,
          userId: parentUserId,
          title: 'Riepilogo presenze di ieri',
          content: `Assenze e ritardi registrati ieri:\n\n${lines.join('\n')}`,
          type: 'ATTENDANCE',
          actionUrl: '/dashboard/parent',
          sourceType: 'attendance-digest',
        },
        { sendEmail: true },
      );
      emailsEnqueued++;
    } catch (err) {
      // Un genitore problematico non deve bloccare il giro degli altri
      logger.warn(`parentAttendanceDigest: dispatch fallito per genitore ${parentUserId}`, err);
    }
  }

  logger.info(
    `parentAttendanceDigest: ${byParent.size} digest, ${emailsEnqueued} email accodate (${records.length} record)`,
  );
  return { pendingDigests: byParent.size, emailsEnqueued };
}

/**
 * Promemoria fine prova: i tenant con trialUntil entro 3 giorni, ancora
 * attivi e SENZA subscription ricevono una notifica (in-app + email) verso
 * gli ADMIN/DIRECTOR. Anti-spam: massimo una notifica ogni 4 giorni per
 * tenant, tracciata via Notification(sourceType='trial-reminder',
 * sourceId=tenantId). notifyTenantAdmins non lancia mai per contratto,
 * quindi un tenant problematico non blocca il giro degli altri.
 */
export async function runTrialEndingReminder(): Promise<{
  candidates: number;
  notified: number;
  skipped: number;
}> {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * DAY_MS);
  const dedupeSince = new Date(now.getTime() - 4 * DAY_MS);

  // Chi ha già un abbonamento (o è disattivato) non è un candidato:
  // il filtro sta nella query, non in memoria
  const tenants = await prisma.tenant.findMany({
    where: {
      isActive: true,
      trialUntil: { gte: now, lte: horizon },
      subscription: { is: null },
    },
    select: { id: true, name: true, trialUntil: true },
  });

  let notified = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    // Dedup: se esiste già un promemoria recente per questo tenant, salta
    const recentReminder = await prisma.notification.findFirst({
      where: {
        tenantId: tenant.id,
        sourceType: 'trial-reminder',
        sourceId: tenant.id,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (recentReminder) {
      skipped++;
      continue;
    }

    const endDate = tenant.trialUntil
      ? tenant.trialUntil.toLocaleDateString('it-IT')
      : 'a breve';

    await notifyTenantAdmins(tenant.id, {
      title: `La prova termina il ${endDate}`,
      content: `Il periodo di prova di ${tenant.name} termina il ${endDate}. Attiva un piano per continuare a usare InsegnaMi.pro senza interruzioni.`,
      type: 'REMINDER',
      actionUrl: '/dashboard/billing',
      sourceType: 'trial-reminder',
      sourceId: tenant.id,
    });
    notified++;
  }

  logger.info(
    `runTrialEndingReminder: ${notified} notified, ${skipped} skipped (${tenants.length} candidates)`,
  );
  return { candidates: tenants.length, notified, skipped };
}

/**
 * Retention del registro AutomationRun: elimina le run più vecchie di 90
 * giorni. Idempotente. Ritorna il numero di righe eliminate.
 */
export async function retentionAutomationRuns(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await prisma.automationRun.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });
  logger.info(`retentionAutomationRuns: ${result.count} run oltre i 90 giorni eliminate`);
  return { deleted: result.count };
}

/**
 * Trial scaduti mai convertiti: le Subscription TRIALING con trialEnd
 * passato (nessun pagamento arrivato — il webhook Stripe le avrebbe portate
 * ad ACTIVE) diventano UNPAID e la cache di accesso del tenant viene
 * invalidata così il blocco commerciale scatta subito.
 */
export async function expireStaleSubscriptions(): Promise<{ expired: number }> {
  const now = new Date();
  const stale = await prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEnd: { lt: now },
    },
    select: { id: true, tenantId: true },
  });

  let expired = 0;
  for (const sub of stale) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'UNPAID' },
      });
      const { invalidateTenantAccessCache } = await import('@/lib/tenant-access');
      await invalidateTenantAccessCache(sub.tenantId);
      expired++;
    } catch (err) {
      // Un tenant problematico non blocca il giro degli altri
      logger.warn(`expireStaleSubscriptions: update fallita per subscription ${sub.id}`, err);
    }
  }

  logger.info(`expireStaleSubscriptions: ${expired}/${stale.length} trial scaduti → UNPAID`);
  return { expired };
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
    case 'deactivate-expired-tenants': {
      const { deactivateExpiredTenants } = await import('@/lib/tenant-access');
      return withAuditRun(name, () => deactivateExpiredTenants());
    }
    case 'auto-complete-lessons': {
      const { autoCompletePastLessons } = await import('@/lib/hours/consume');
      return withAuditRun(name, () => autoCompletePastLessons(30));
    }
    case 'trial-ending-reminder':
      return withAuditRun(name, () => runTrialEndingReminder());
    case 'cleanup-notifications': {
      const { NotificationService } = await import('@/lib/notification-service');
      return withAuditRun(name, async () => ({
        deleted: await NotificationService.cleanupExpiredNotifications(),
      }));
    }
    case 'retention-automation-runs':
      return withAuditRun(name, () => retentionAutomationRuns());
    case 'email-queue-clean': {
      const { EmailQueueMonitor } = await import('@/lib/email-queue');
      return withAuditRun(name, async () => {
        await EmailQueueMonitor.cleanOldJobs();
        return { cleaned: true };
      });
    }
    case 'expire-stale-subscriptions':
      return withAuditRun(name, () => expireStaleSubscriptions());
    case 'reset-demo-tenant': {
      // Wipe + ri-seed del tenant demo pubblico (slug 'demo'):
      // dati sempre freschi per chi prova la piattaforma.
      const { resetDemoTenant } = await import('@/lib/demo/seed-demo-tenant');
      return withAuditRun(name, () => resetDemoTenant());
    }
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
    { name: 'mark-payments-overdue', cron: '0 6 * * *' },     // daily 06:00
    { name: 'daily-automation',       cron: '0 2 * * *' },     // daily 02:00 (lessons + payment reminders)
    { name: 'parent-attendance-digest', cron: '0 9 * * *' },   // daily 09:00
    { name: 'deactivate-expired-tenants', cron: '15 3 * * *' },// daily 03:15 (after most subs renew)
    { name: 'auto-complete-lessons',      cron: '30 6 * * *' }, // daily 06:30 — past SCHEDULED → COMPLETED + consume hours
    { name: 'trial-ending-reminder',      cron: '0 10 * * *' }, // daily 10:00 — promemoria fine prova agli admin
    { name: 'cleanup-notifications',      cron: '0 4 * * *' },  // daily 04:00 — elimina notifiche scadute (expiresAt)
    { name: 'retention-automation-runs',  cron: '30 4 * * *' }, // daily 04:30 — retention 90gg del registro run
    { name: 'email-queue-clean',          cron: '0 5 * * *' },  // daily 05:00 — pulizia job completati/falliti coda email
    { name: 'expire-stale-subscriptions', cron: '45 3 * * *' }, // daily 03:45 — TRIALING scaduti → UNPAID + invalidazione cache
    { name: 'reset-demo-tenant',          cron: '0 3 * * *' },  // daily 03:00 — wipe + ri-seed del tenant demo pubblico
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
