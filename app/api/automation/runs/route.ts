import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { readWorkerHeartbeat } from '@/lib/workers/heartbeat-status';

/**
 * GET /api/automation/runs — elenco esecuzioni cron per la pagina automazioni.
 * SUPERADMIN: vista piattaforma (tutte le run). ADMIN: vista filtrata al
 * proprio tenant (solo le AutomationRun con tenantId popolato).
 * Il badge salute worker (heartbeat) è incluso per entrambi; GET
 * /api/automation resta SUPERADMIN-only per contratto RBAC.
 */
export async function GET(_request: NextRequest) {
  try {
    const ctx = await requireAuth({ roles: ['SUPERADMIN', 'ADMIN'] });

    const runWhere = ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId };

    const [lastDailyRun, recentRuns, workerHeartbeat] = await Promise.all([
      prisma.automationRun.findFirst({
        where: { jobName: 'daily-automation', status: 'SUCCESS', ...runWhere },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, finishedAt: true },
      }),
      prisma.automationRun.findMany({
        where: runWhere,
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          jobName: true,
          tenantId: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          error: true,
        },
      }),
      readWorkerHeartbeat(),
    ]);

    return NextResponse.json({
      data: recentRuns,
      meta: {
        scope: ctx.isSuperAdmin ? 'platform' : 'tenant',
        lastDailyRun,
        workerHeartbeat,
      },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    logger.error('Automation runs API error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
