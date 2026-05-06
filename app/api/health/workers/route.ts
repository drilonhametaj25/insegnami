import { NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { getAllQueueHealth } from '@/lib/queue/health';
import { prisma } from '@/lib/db';

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

  const [queues, lastRuns, failedRuns] = await Promise.all([
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
  ]);

  return NextResponse.json({
    queues,
    recentRuns: lastRuns,
    recentFailures: failedRuns,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
