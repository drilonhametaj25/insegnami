import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema
const academicYearSchema = z.object({
  name: z.string().min(1, 'Nome anno scolastico obbligatorio'),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  isCurrent: z.boolean().optional().default(false),
});

// GET /api/academic-years - List academic years
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const all = searchParams.get('all') === 'true';
    const currentOnly = searchParams.get('current') === 'true';

    const skip = (page - 1) * limit;

    // Build where clause with tenant scoping
    const where: any = {};

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    if (currentOnly) {
      where.isCurrent = true;
    }

    // Get academic years with periods
    const [academicYears, total] = await Promise.all([
      prisma.academicYear.findMany({
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
        orderBy: { startDate: 'desc' },
        ...(all ? {} : { skip, take: limit }),
      }),
      prisma.academicYear.count({ where }),
    ]);

    // Calculate total grades per academic year from periods
    const academicYearsWithCounts = academicYears.map((year) => ({
      ...year,
      _count: {
        grades: year.periods.reduce((sum, p) => sum + (p._count?.grades || 0), 0),
        reportCards: year.periods.reduce((sum, p) => sum + (p._count?.reportCards || 0), 0),
      },
    }));

    return NextResponse.json({
      academicYears: academicYearsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Academic years GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/academic-years - Create a new academic year
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create academic years
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = academicYearSchema.parse(body);

    // Validate dates
    if (validatedData.endDate <= validatedData.startDate) {
      return NextResponse.json(
        { error: 'La data di fine deve essere successiva alla data di inizio' },
        { status: 400 }
      );
    }

    // Check if name already exists for this tenant
    const existingYear = await prisma.academicYear.findFirst({
      where: {
        name: validatedData.name,
        tenantId: session.user.tenantId,
      },
    });

    if (existingYear) {
      return NextResponse.json(
        { error: 'Anno scolastico con questo nome già esistente' },
        { status: 400 }
      );
    }

    // If this is set as current, unset other current years
    if (validatedData.isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          tenantId: session.user.tenantId,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });
    }

    // Create the academic year
    const academicYear = await prisma.academicYear.create({
      data: {
        ...validatedData,
        tenantId: session.user.tenantId,
      },
      include: {
        periods: true,
      },
    });

    // Return with default counts (0 for new year)
    return NextResponse.json({
      ...academicYear,
      _count: { grades: 0, reportCards: 0 },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Academic year POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
