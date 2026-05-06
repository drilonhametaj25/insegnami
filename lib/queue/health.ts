import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';

export type QueueHealth = {
  name: string;
  available: boolean;
  counts?: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  error?: string;
};

const QUEUE_NAMES = ['email', 'pdf', 'notification', 'automation', 'cron'] as const;

/**
 * Inspect every BullMQ queue we use. Returns a stable shape for monitoring
 * dashboards and uptime probes — never throws.
 *
 * `available: false` means Redis is unreachable or the queue isn't registered.
 * A queue with `available: true` and a high `failed` count is the most useful
 * alerting signal.
 */
export async function getAllQueueHealth(): Promise<QueueHealth[]> {
  const results: QueueHealth[] = [];
  const conn = redis.getConnectionConfig();
  const redisConfigured = !!process.env.REDIS_URL;

  for (const name of QUEUE_NAMES) {
    if (!redisConfigured) {
      results.push({ name, available: false, error: 'REDIS_URL not configured' });
      continue;
    }

    try {
      // Construct an ephemeral Queue handle so health checks don't depend on
      // any worker module having been imported.
      const q = new Queue(name, { connection: conn });
      const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
      results.push({
        name,
        available: true,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
        },
      });
      await q.close();
    } catch (err) {
      results.push({
        name,
        available: false,
        error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      });
    }
  }

  return results;
}

export type ServiceHealth = {
  status: 'ok' | 'degraded' | 'down';
  checks: {
    db: { ok: boolean; latencyMs?: number; error?: string };
    redis: { ok: boolean; latencyMs?: number; error?: string };
  };
  timestamp: string;
};

/**
 * Top-level health probe for uptime monitors. Hits the DB with a trivial
 * query and pings Redis. Returns 200 when both are up, 503 (set by the route
 * handler reading status) when degraded.
 */
export async function getServiceHealth(): Promise<ServiceHealth> {
  const { prisma } = await import('@/lib/db');

  const dbStart = Date.now();
  let db: ServiceHealth['checks']['db'];
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    db = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    db = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' };
  }

  const redisStart = Date.now();
  let redisCheck: ServiceHealth['checks']['redis'];
  try {
    const client = redis.getClient();
    if (!client) {
      redisCheck = { ok: false, error: 'REDIS_URL not configured' };
    } else {
      await client.ping();
      redisCheck = { ok: true, latencyMs: Date.now() - redisStart };
    }
  } catch (err) {
    redisCheck = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' };
  }

  const allOk = db.ok && redisCheck.ok;
  return {
    status: allOk ? 'ok' : 'degraded',
    checks: { db, redis: redisCheck },
    timestamp: new Date().toISOString(),
  };
}
