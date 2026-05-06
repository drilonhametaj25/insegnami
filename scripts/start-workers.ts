/**
 * Standalone worker process — runs all BullMQ consumers and the cron scheduler.
 *
 * Run via:
 *   npm run worker        # one-shot (production)
 *   npm run dev:worker    # tsx watch (development)
 *
 * Environment loading:
 *   - In Docker, env_file in docker-compose feeds DATABASE_URL/REDIS_URL/SMTP_*.
 *   - For local dev: load env via the shell (e.g. `set -a; source .env; set +a; npm run worker`)
 *     or pass --env-file=.env to node 20.6+ (works through tsx's wrapper).
 *
 * The Next.js app process should NOT instantiate workers (would race against
 * this one and waste connections on serverless deployments). API routes only
 * publish to queues; this process consumes them.
 */

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

async function main() {
  if (!process.env.REDIS_URL) {
    logger.error('REDIS_URL is not set — cannot start workers. Configure Redis and retry.');
    process.exit(1);
  }

  // Importing these modules has the side effect of creating Worker instances.
  // The pattern is intentional: each module owns its lifecycle and exits cleanly
  // when the process receives SIGTERM (handled below via worker.close()).
  const [emailMod, automationMod, cron] = await Promise.all([
    import('@/lib/email-queue'),
    import('@/lib/automation-worker'),
    import('@/lib/workers/cron-scheduler'),
  ]);

  // Boot the cron worker explicitly (factory pattern; not auto-instantiated).
  const cronWorker = cron.getCronWorker();
  if (!cronWorker) {
    logger.error('Cron worker failed to start');
    process.exit(1);
  }

  // Idempotently register repeating jobs on every boot so a redeploy reflects
  // schedule changes immediately.
  await cron.registerCronJobs();

  logger.info('All workers up: email, automation, cron');

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, draining workers...`);
    try {
      await Promise.all([
        emailMod.shutdownEmailQueue(),
        automationMod.automationWorker.close(),
        cronWorker.close(),
      ]);
      const client = redis.getClient();
      if (client) await client.quit();
    } catch (err) {
      logger.error('Error during shutdown', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Keep the event loop alive by blocking forever — workers handle their own
  // events. Without this `tsx` would exit when the script body returns.
  await new Promise(() => {/* never resolves */});
}

main().catch((err) => {
  logger.error('Fatal error in worker process', err);
  process.exit(1);
});
