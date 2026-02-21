import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Helper to calculate counts from periods
function withCalculatedCounts(year: any) {
  if (!year) return null;
  return {
    ...year,
    _count: {
      grades: year.periods?.reduce((sum: number, p: any) => sum + (p._count?.grades || 0), 0) || 0,
      reportCards: year.periods?.reduce((sum: number, p: any) => sum + (p._count?.reportCards || 0), 0) || 0,
    },
  };
}

// GET /api/academic-years/current - Get current academic year
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.role === 'SUPERADMIN'
      ? undefined
      : session.user.tenantId;

    const currentYear = await prisma.academicYear.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        isCurrent: true,
      },
      include: {
        periods: {
          orderBy: { startDate: 'asc' },
          include: {
            _count: {
              select: {
                grades: true,
                reportCards: true,
              },
            },
          },
        },
      },
    });

    if (!currentYear) {
      // Return the most recent year if no current is set
      const mostRecentYear = await prisma.academicYear.findFirst({
        where: tenantId ? { tenantId } : {},
        orderBy: { startDate: 'desc' },
        include: {
          periods: {
            orderBy: { startDate: 'asc' },
            include: {
              _count: {
                select: {
                  grades: true,
                  reportCards: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(withCalculatedCounts(mostRecentYear));
    }

    // Determine current period based on current date
    const now = new Date();
    const currentPeriod = currentYear.periods.find(
      (p) => p.startDate <= now && p.endDate >= now
    ) || currentYear.periods[0] || null;

    return NextResponse.json({
      ...withCalculatedCounts(currentYear),
      currentPeriod,
    });
  } catch (error) {
    console.error('Current academic year GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/academic-years/current - Set current academic year
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can set current year
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { academicYearId } = body;

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId è obbligatorio' },
        { status: 400 }
      );
    }

    // Verify the year exists and belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        tenantId: session.user.tenantId,
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Unset all current years for this tenant
    await prisma.academicYear.updateMany({
      where: {
        tenantId: session.user.tenantId,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    // Set the new current year
    const updatedYear = await prisma.academicYear.update({
      where: { id: academicYearId },
      data: { isCurrent: true },
      include: {
        periods: {
          orderBy: { startDate: 'asc' },
          include: {
            _count: {
              select: {
                grades: true,
                reportCards: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(withCalculatedCounts(updatedYear));
  } catch (error) {
    console.error('Set current academic year error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
