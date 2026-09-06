import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const LOG_STATUSES = ['QUEUED', 'SENT', 'FAILED'] as const;

/**
 * GET /api/automation/email-log — registro consegna email del tenant.
 * ADMIN: sempre filtrato sul proprio tenant. SUPERADMIN: piattaforma intera,
 * con filtro opzionale ?tenantId=. Envelope {data, meta}.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ roles: ['SUPERADMIN', 'ADMIN'] });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const statusParam = searchParams.get('status');
    const sourceType = searchParams.get('sourceType');

    const where: any = ctx.isSuperAdmin
      ? (searchParams.get('tenantId') ? { tenantId: searchParams.get('tenantId') } : {})
      : { tenantId: ctx.tenantId };

    if (statusParam && (LOG_STATUSES as readonly string[]).includes(statusParam)) {
      where.status = statusParam;
    }
    if (sourceType) where.sourceType = sourceType;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          to: true,
          subject: true,
          sourceType: true,
          sourceId: true,
          status: true,
          error: true,
          messageId: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    logger.error('Email log API error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
