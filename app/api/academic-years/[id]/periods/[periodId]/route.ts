import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { PeriodType } from '@prisma/client';

// Validation schema for update
const periodUpdateSchema = z.object({
  name: z.string().min(1, 'Nome periodo obbligatorio').optional(),
  periodType: z.nativeEnum(PeriodType).optional(),
  startDate: z.string().transform((val) => new Date(val)).optional(),
  endDate: z.string().transform((val) => new Date(val)).optional(),
  orderIndex: z.number().optional(),
});

// GET /api/academic-years/[id]/periods/[periodId] - Get a single period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: academicYearId, periodId } = await params;

    // First verify the academic year belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    const period = await prisma.academicPeriod.findFirst({
      where: {
        id: periodId,
        academicYearId,
      },
      include: {
        academicYear: true,
        _count: {
          select: {
            grades: true,
            reportCards: true,
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Periodo non trovato' }, { status: 404 });
    }

    return NextResponse.json(period);
  } catch (error) {
    console.error('Period GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/academic-years/[id]/periods/[periodId] - Update a period
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can update periods
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: academicYearId, periodId } = await params;
    const body = await request.json();
    const validatedData = periodUpdateSchema.parse(body);

    // Verify the academic year belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        tenantId: session.user.tenantId,
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Check if period exists
    const existingPeriod = await prisma.academicPeriod.findFirst({
      where: {
        id: periodId,
        academicYearId,
      },
    });

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Periodo non trovato' }, { status: 404 });
    }

    // Validate dates if provided
    const startDate = validatedData.startDate || existingPeriod.startDate;
    const endDate = validatedData.endDate || existingPeriod.endDate;

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'La data di fine deve essere successiva alla data di inizio' },
        { status: 400 }
      );
    }

    // Check that period dates are within academic year
    if (
      startDate < academicYear.startDate ||
      endDate > academicYear.endDate
    ) {
      return NextResponse.json(
        { error: 'Le date del periodo devono essere comprese nell\'anno scolastico' },
        { status: 400 }
      );
    }

    // Build update data (map periodType to type field)
    const updateData: any = {};
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.periodType) updateData.type = validatedData.periodType;
    if (validatedData.startDate) updateData.startDate = validatedData.startDate;
    if (validatedData.endDate) updateData.endDate = validatedData.endDate;
    if (validatedData.orderIndex !== undefined) updateData.orderIndex = validatedData.orderIndex;

    // Update the period
    const updatedPeriod = await prisma.academicPeriod.update({
      where: { id: periodId },
      data: updateData,
      include: {
        _count: {
          select: {
            grades: true,
            reportCards: true,
          },
        },
      },
    });

    return NextResponse.json(updatedPeriod);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Period PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/academic-years/[id]/periods/[periodId] - Delete a period
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can delete periods
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: academicYearId, periodId } = await params;

    // Verify the academic year belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        tenantId: session.user.tenantId,
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Check if period exists
    const period = await prisma.academicPeriod.findFirst({
      where: {
        id: periodId,
        academicYearId,
      },
      include: {
        _count: {
          select: {
            grades: true,
            reportCards: true,
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Periodo non trovato' }, { status: 404 });
    }

    // Check if period has related data
    const hasRelatedData =
      period._count.grades > 0 ||
      period._count.reportCards > 0;

    if (hasRelatedData) {
      return NextResponse.json(
        { error: 'Impossibile eliminare: periodo con voti o pagelle associate' },
        { status: 400 }
      );
    }

    await prisma.academicPeriod.delete({ where: { id: periodId } });

    return NextResponse.json({
      success: true,
      message: 'Periodo eliminato',
    });
  } catch (error) {
    console.error('Period DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
