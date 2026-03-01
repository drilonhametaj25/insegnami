import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const period = searchParams.get('period');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query filters
    const where: any = {
      tenantId: session.user.tenantId,
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

    // Only admin can create reports
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const userId = session.user.id;

    const body = await request.json();
    const validatedData = createReportSchema.parse(body);

    // Create report in database
    const report = await prisma.report.create({
      data: {
        tenantId: session.user.tenantId,
        title: validatedData.title,
        type: validatedData.type as any,
        period: validatedData.period as any,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        data: validatedData.data || {},
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
