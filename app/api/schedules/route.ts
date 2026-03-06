import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema for schedule creation
const scheduleCreateSchema = z.object({
  name: z.string().min(1, 'Nome richiesto'),
  academicYearId: z.string().cuid('Anno accademico richiesto'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  config: z.object({
    hardConstraints: z.object({
      noTeacherOverlap: z.boolean().default(true),
      noClassOverlap: z.boolean().default(true),
      noRoomOverlap: z.boolean().default(true),
      respectWeeklyHours: z.boolean().default(true),
    }).optional(),
    softConstraints: z.object({
      difficultSubjectsInMorning: z.number().min(0).max(10).default(8),
      noGaps: z.number().min(0).max(10).default(7),
      balancedDistribution: z.number().min(0).max(10).default(6),
      maxConsecutiveSameSubject: z.number().min(0).max(10).default(5),
      lunchBreakPreference: z.number().min(0).max(10).default(4),
      teacherLoadBalance: z.number().min(0).max(10).default(3),
    }).optional(),
    algorithmParams: z.object({
      maxIterations: z.number().default(100000),
      optimizationRounds: z.number().default(1000),
      timeout: z.number().default(30000),
    }).optional(),
  }).optional(),
});

// GET: Lista orari
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const academicYearId = searchParams.get('academicYearId');

    const skip = (page - 1) * limit;

    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (status) where.status = status;
    if (academicYearId) where.academicYearId = academicYearId;

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
            },
          },
          _count: {
            select: {
              slots: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.schedule.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      schedules,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST: Crea nuovo orario
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Solo admin possono creare orari
    if (!['ADMIN', 'DIRECTOR', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = scheduleCreateSchema.parse(body);

    // Verifica anno accademico
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: validatedData.academicYearId,
        tenantId: session.user.tenantId,
      },
    });

    if (!academicYear) {
      return NextResponse.json(
        { error: 'Anno accademico non trovato' },
        { status: 404 }
      );
    }

    // Config di default se non fornita
    const defaultConfig = {
      hardConstraints: {
        noTeacherOverlap: true,
        noClassOverlap: true,
        noRoomOverlap: true,
        respectWeeklyHours: true,
      },
      softConstraints: {
        difficultSubjectsInMorning: 8,
        noGaps: 7,
        balancedDistribution: 6,
        maxConsecutiveSameSubject: 5,
        lunchBreakPreference: 4,
        teacherLoadBalance: 3,
      },
      algorithmParams: {
        maxIterations: 100000,
        optimizationRounds: 1000,
        timeout: 30000,
      },
    };

    const config = {
      ...defaultConfig,
      ...validatedData.config,
      hardConstraints: {
        ...defaultConfig.hardConstraints,
        ...validatedData.config?.hardConstraints,
      },
      softConstraints: {
        ...defaultConfig.softConstraints,
        ...validatedData.config?.softConstraints,
      },
      algorithmParams: {
        ...defaultConfig.algorithmParams,
        ...validatedData.config?.algorithmParams,
      },
    };

    const schedule = await prisma.schedule.create({
      data: {
        name: validatedData.name,
        tenantId: session.user.tenantId,
        academicYearId: validatedData.academicYearId,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        config: config,
        status: 'DRAFT',
        createdBy: session.user.id || 'system',
      },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
