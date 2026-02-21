import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for update
const academicYearUpdateSchema = z.object({
  name: z.string().min(1, 'Nome anno scolastico obbligatorio').optional(),
  startDate: z.string().transform((val) => new Date(val)).optional(),
  endDate: z.string().transform((val) => new Date(val)).optional(),
  isCurrent: z.boolean().optional(),
});

// GET /api/academic-years/[id] - Get a single academic year
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Build where clause with tenant scoping
    const where: any = { id };
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    const academicYear = await prisma.academicYear.findFirst({
      where,
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

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Calculate total grades from periods
    const yearWithCounts = {
      ...academicYear,
      _count: {
        grades: academicYear.periods.reduce((sum, p) => sum + (p._count?.grades || 0), 0),
        reportCards: academicYear.periods.reduce((sum, p) => sum + (p._count?.reportCards || 0), 0),
      },
    };

    return NextResponse.json(yearWithCounts);
  } catch (error) {
    console.error('Academic year GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/academic-years/[id] - Update an academic year
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can update academic years
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = academicYearUpdateSchema.parse(body);

    // Check if academic year exists and belongs to tenant
    const existingYear = await prisma.academicYear.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Validate dates if both provided
    const startDate = validatedData.startDate || existingYear.startDate;
    const endDate = validatedData.endDate || existingYear.endDate;
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'La data di fine deve essere successiva alla data di inizio' },
        { status: 400 }
      );
    }

    // Check if new name conflicts with another year
    if (validatedData.name && validatedData.name !== existingYear.name) {
      const nameConflict = await prisma.academicYear.findFirst({
        where: {
          name: validatedData.name,
          tenantId: session.user.tenantId,
          id: { not: id },
        },
      });

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Anno scolastico con questo nome già esistente' },
          { status: 400 }
        );
      }
    }

    // If this is set as current, unset other current years
    if (validatedData.isCurrent && !existingYear.isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          tenantId: session.user.tenantId,
          isCurrent: true,
          id: { not: id },
        },
        data: { isCurrent: false },
      });
    }

    // Update the academic year
    const updatedYear = await prisma.academicYear.update({
      where: { id },
      data: validatedData,
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

    // Calculate total grades from periods
    const yearWithCounts = {
      ...updatedYear,
      _count: {
        grades: updatedYear.periods.reduce((sum, p) => sum + (p._count?.grades || 0), 0),
        reportCards: updatedYear.periods.reduce((sum, p) => sum + (p._count?.reportCards || 0), 0),
      },
    };

    return NextResponse.json(yearWithCounts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Academic year PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/academic-years/[id] - Delete an academic year
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can delete academic years
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if academic year exists and belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        periods: {
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

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Check if year has related data (through periods)
    const totalGrades = academicYear.periods.reduce((sum, p) => sum + (p._count?.grades || 0), 0);
    const totalReportCards = academicYear.periods.reduce((sum, p) => sum + (p._count?.reportCards || 0), 0);
    const hasRelatedData = totalGrades > 0 || totalReportCards > 0;

    if (hasRelatedData) {
      return NextResponse.json(
        { error: 'Impossibile eliminare: anno scolastico con voti o pagelle associate' },
        { status: 400 }
      );
    }

    // Delete periods first, then the academic year
    await prisma.academicPeriod.deleteMany({
      where: { academicYearId: id },
    });

    await prisma.academicYear.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Anno scolastico eliminato',
    });
  } catch (error) {
    console.error('Academic year DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
