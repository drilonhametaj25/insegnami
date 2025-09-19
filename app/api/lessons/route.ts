import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema for lesson validation
const lessonSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto'),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  room: z.string().optional(),
  classId: z.string().cuid(),
  teacherId: z.string().cuid(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
  materials: z.string().optional(),
  homework: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // Build where clause based on user role and filters
    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;
    if (status) where.status = status;

    // Handle date filtering
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (startDate && endDate) {
      // Handle date range filtering for calendar
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      };
    } else if (startDate) {
      where.startTime = {
        gte: new Date(startDate),
      };
    } else if (endDate) {
      where.startTime = {
        lte: new Date(endDate + 'T23:59:59.999Z'),
      };
    }

    // Role-based filtering
    if (session.user.role === 'TEACHER') {
      where.teacherId = session.user.id;
    } else if (session.user.role === 'STUDENT') {
      where.class = {
        students: {
          some: {
            student: {
              // We need to get the student record that matches this user
              // This is a simplified approach - you might need to adjust based on your auth setup
              email: session.user.email,
            },
          },
        },
      };
    }

    const [lessons, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        include: {
          class: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          attendance: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.lesson.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      lessons,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can create lessons
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = lessonSchema.parse(body);

    // Verify class belongs to the same tenant
    const classRecord = await prisma.class.findFirst({
      where: {
        id: validatedData.classId,
        tenantId: session.user.tenantId,
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // Verify teacher belongs to the same tenant
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: validatedData.teacherId,
        tenantId: session.user.tenantId,
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
    }

    // Check for overlapping lessons
    const overlapping = await prisma.lesson.findFirst({
      where: {
        teacherId: validatedData.teacherId,
        OR: [
          {
            startTime: {
              lte: new Date(validatedData.startTime),
            },
            endTime: {
              gt: new Date(validatedData.startTime),
            },
          },
          {
            startTime: {
              lt: new Date(validatedData.endTime),
            },
            endTime: {
              gte: new Date(validatedData.endTime),
            },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: 'Il docente ha già una lezione in questo orario' },
        { status: 400 }
      );
    }

    const lesson = await prisma.lesson.create({
      data: {
        ...validatedData,
        tenantId: session.user.tenantId,
        startTime: new Date(validatedData.startTime),
        endTime: new Date(validatedData.endTime),
      },
      include: {
        class: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating lesson:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
