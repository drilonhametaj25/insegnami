import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { requireAuth, authError } from '@/lib/api-auth';
import { computeAnalytics, REPORT_TYPE_TO_ANALYTICS } from '@/lib/analytics/compute';

const createReportSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto'),
  type: z.enum(['ATTENDANCE', 'FINANCIAL', 'PROGRESS', 'OVERVIEW', 'CLASS_ANALYTICS', 'TEACHER_PERFORMANCE']),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  filters: z.record(z.any()).optional(),
  data: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'analytics' } });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const period = searchParams.get('period');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query filters
    const where: any = {
      tenantId: ctx.tenantId,
    };

    if (type) {
      where.type = type;
    }

    if (period) {
      where.period = period;
    }

    // Get reports from database
    const [reports, totalCount] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      totalCount,
      hasMore: offset + reports.length < totalCount,
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admin can create reports
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const userId = session.user.id;

    const body = await request.json();
    const validatedData = createReportSchema.parse(body);

    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    // Snapshot: i dati vengono calcolati ORA e persistiti in report.data,
    // così il report resta stabile anche quando i dati sottostanti cambiano.
    let snapshot: Record<string, any> = validatedData.data || {};
    if (Object.keys(snapshot).length === 0) {
      const analyticsType = REPORT_TYPE_TO_ANALYTICS[validatedData.type] || 'overview';
      try {
        snapshot = await computeAnalytics(
          analyticsType,
          session.user.tenantId,
          startDate,
          endDate
        );
      } catch (computeError) {
        // Il fallimento del calcolo non blocca la creazione: la pagina di
        // dettaglio ricade sul ricalcolo live per i report con data vuoto.
        console.error('Report snapshot compute error:', computeError);
        snapshot = {};
      }
    }

    // Create report in database
    const report = await prisma.report.create({
      data: {
        tenantId: session.user.tenantId,
        title: validatedData.title,
        type: validatedData.type as any,
        period: validatedData.period as any,
        startDate,
        endDate,
        data: snapshot,
        filters: validatedData.filters || {},
        generatedBy: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
