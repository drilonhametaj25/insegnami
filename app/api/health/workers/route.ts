import { NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { getAllQueueHealth } from '@/lib/queue/health';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { HEARTBEAT_KEY, HEARTBEAT_TTL_SECONDS } from '@/lib/workers/heartbeat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/workers — detailed worker / queue status for ops dashboards.
 * ADMIN+ only because it exposes per-queue counts and recent failure history,
 * which we don't want indexed by external monitors.
 */
export async function GET() {
  const session = await getAuth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [queues, lastRuns, failedRuns, heartbeatRaw] = await Promise.all([
    getAllQueueHealth(),
    prisma.automationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { id: true, jobName: true, startedAt: true, finishedAt: true, status: true },
    }),
    prisma.automationRun.findMany({
      where: { status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { id: true, jobName: true, startedAt: true, error: true },
    }),
    redis.get(HEARTBEAT_KEY),
  ]);

  // Freschezza dell'heartbeat del container worker: la chiave ha TTL, quindi
  // un worker morto da più di HEARTBEAT_TTL_SECONDS risulta lastBeat: null.
  const lastBeatMs = heartbeatRaw ? Number(heartbeatRaw) : null;
  const freshSeconds =
    lastBeatMs && Number.isFinite(lastBeatMs)
      ? Math.round((Date.now() - lastBeatMs) / 1000)
      : null;
  const workerHeartbeat = {
    lastBeat: lastBeatMs && Number.isFinite(lastBeatMs) ? new Date(lastBeatMs).toISOString() : null,
    freshSeconds,
    healthy: freshSeconds !== null && freshSeconds <= HEARTBEAT_TTL_SECONDS,
  };

  return NextResponse.json({
    queues,
    workerHeartbeat,
    recentRuns: lastRuns,
    recentFailures: failedRuns,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
