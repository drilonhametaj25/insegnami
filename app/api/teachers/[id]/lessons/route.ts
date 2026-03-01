import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teachers/[id]/lessons - Get lessons for a specific teacher
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Teachers can view their own lessons, admins can view any teacher's lessons
    const canViewLessons =
      ['ADMIN', 'SUPERADMIN'].includes(session.user.role) ||
      (session.user.role === 'TEACHER' && session.user.id === id);

    if (!canViewLessons) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause
    const where: any = {
      teacherId: id,
    };

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.startTime = {};
      if (from) {
        where.startTime.gte = new Date(from);
      }
      if (to) {
        where.startTime.lte = new Date(to);
      }
    }

    // Get total count for pagination
    const total = await prisma.lesson.count({ where });

    // Get lessons with related data
    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            course: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendance: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      lessons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching teacher lessons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
