import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { PeriodType } from '@prisma/client';

// Validation schema
const periodSchema = z.object({
  name: z.string().min(1, 'Nome periodo obbligatorio'),
  periodType: z.nativeEnum(PeriodType),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  orderIndex: z.number().optional(),
});

// GET /api/academic-years/[id]/periods - List periods for an academic year
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: academicYearId } = await params;

    // Verify academic year exists and belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    const periods = await prisma.academicPeriod.findMany({
      where: { academicYearId },
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: {
            grades: true,
            reportCards: true,
          },
        },
      },
    });

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Periods GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/academic-years/[id]/periods - Create a new period
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create periods
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: academicYearId } = await params;
    const body = await request.json();
    const validatedData = periodSchema.parse(body);

    // Verify academic year exists and belongs to tenant
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        tenantId: session.user.tenantId,
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Anno scolastico non trovato' }, { status: 404 });
    }

    // Validate dates
    if (validatedData.endDate <= validatedData.startDate) {
      return NextResponse.json(
        { error: 'La data di fine deve essere successiva alla data di inizio' },
        { status: 400 }
      );
    }

    // Check that period dates are within academic year
    if (
      validatedData.startDate < academicYear.startDate ||
      validatedData.endDate > academicYear.endDate
    ) {
      return NextResponse.json(
        { error: 'Le date del periodo devono essere comprese nell\'anno scolastico' },
        { status: 400 }
      );
    }

    // Get next order index
    const existingPeriods = await prisma.academicPeriod.count({
      where: { academicYearId },
    });

    // Create the period
    const period = await prisma.academicPeriod.create({
      data: {
        name: validatedData.name,
        type: validatedData.periodType,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        orderIndex: validatedData.orderIndex ?? existingPeriods,
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

    return NextResponse.json(period, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Period POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
