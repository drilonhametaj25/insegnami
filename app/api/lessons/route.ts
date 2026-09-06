import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getTeacherIdForUser, getStudentIdForUser, getChildStudentIds, type AuthContext } from '@/lib/api-auth';
import { findLessonConflicts, conflictMessage } from '@/lib/lessons/conflicts';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

// Schema for lesson validation
const lessonSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto'),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  room: z.string().optional(),
  classId: z.string().cuid(),
  teacherId: z.string().cuid(),
  // Materia opzionale (dalle materie della classe)
  subjectId: z.string().cuid().optional().nullable(),
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

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');
    const subjectId = searchParams.get('subjectId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause based on user role and filters
    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = status;

    // Ricerca testuale su titolo/descrizione e nome classe
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { class: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

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
    // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
    const ctx = {
      userId: session.user.id ?? '',
      tenantId: session.user.tenantId,
      role: session.user.role,
      email: session.user.email ?? '',
      isSuperAdmin: session.user.role === 'SUPERADMIN',
      session,
    } as AuthContext;

    if (session.user.role === 'TEACHER') {
      const tid = await getTeacherIdForUser(ctx);
      where.teacherId = tid ?? '__no_teacher__';
    } else if (session.user.role === 'STUDENT') {
      const sid = await getStudentIdForUser(ctx);
      where.class = {
        students: {
          some: {
            studentId: sid ?? '__no_student__',
          },
        },
      };
    } else if (session.user.role === 'PARENT') {
      // Wave 2: lezioni delle classi dei figli (guardian + fallback parentUserId);
      // senza figli → sentinella che non matcha nulla
      const childIds = await getChildStudentIds(ctx);
      where.class = {
        students: {
          some: {
            studentId: { in: childIds.length > 0 ? childIds : ['__none__'] },
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
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
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

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Matrice: lesson create concesso ad admin, direzione, segreteria e docenti
    if (!['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
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

    // Materia opzionale: se indicata deve appartenere allo stesso tenant
    if (validatedData.subjectId) {
      const subject = await prisma.subject.findFirst({
        where: {
          id: validatedData.subjectId,
          tenantId: session.user.tenantId,
        },
      });
      if (!subject) {
        return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
      }
    }

    // Check for overlapping lessons (teacher + room).
    const conflicts = await findLessonConflicts({
      tenantId: session.user.tenantId,
      teacherId: validatedData.teacherId,
      room: validatedData.room ?? null,
      startTime: new Date(validatedData.startTime),
      endTime: new Date(validatedData.endTime),
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: conflictMessage(conflicts), conflicts },
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

    // NOTA: la generazione delle serie ricorrenti è EAGER via
    // POST /api/lessons/recurring (RRULE canonica, lib/lessons/recurrence.ts).
    // Il vecchio trigger BullMQ "recurring-lesson" è deprecato: il processor
    // in automation-worker verrà rimosso separatamente.

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
