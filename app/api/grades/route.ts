import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { GradeType } from '@prisma/client';

// Validation schema
const gradeSchema = z.object({
  studentId: z.string().min(1, 'Studente obbligatorio'),
  subjectId: z.string().min(1, 'Materia obbligatoria'),
  classId: z.string().min(1, 'Classe obbligatoria'),
  periodId: z.string().optional().nullable(),
  value: z.number().min(0).max(10),
  valueText: z.string().optional().nullable(),
  weight: z.number().min(0).max(5).optional().default(1.0),
  type: z.nativeEnum(GradeType).optional().default('WRITTEN'),
  description: z.string().optional().nullable(),
  date: z.string().transform((val) => new Date(val)),
  isVisible: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});

// GET /api/grades - List grades with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const studentId = searchParams.get('studentId');
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');
    const periodId = searchParams.get('periodId');
    const teacherId = searchParams.get('teacherId');
    const type = searchParams.get('type') as GradeType | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const skip = (page - 1) * limit;

    // Build where clause with tenant scoping
    const where: any = {};

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Role-based filters
    if (session.user.role === 'STUDENT') {
      // Students can only see their own grades
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
      });
      if (student) {
        where.studentId = student.id;
        where.isVisible = true;
      }
    } else if (session.user.role === 'PARENT') {
      // Parents can see grades of their children
      // Use relational filter instead of separate query (BUG-027 fix)
      where.student = { parentUserId: session.user.id };
      where.isVisible = true;
    }

    // Apply filters
    if (studentId) where.studentId = studentId;
    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (periodId) where.periodId = periodId;
    if (teacherId) where.teacherId = teacherId;
    if (type) where.type = type;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    // Get grades with relations
    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentCode: true,
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
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          period: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.grade.count({ where }),
    ]);

    return NextResponse.json({
      grades,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Grades GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/grades - Create a new grade
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can create grades
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = gradeSchema.parse(body);

    // Get teacher ID
    let teacherId = body.teacherId;
    if (session.user.role === 'TEACHER') {
      if (!session.user.email) {
        return NextResponse.json({ error: 'Email utente non disponibile' }, { status: 400 });
      }
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher) {
        return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
      }
      teacherId = teacher.id;
    }

    if (!teacherId) {
      return NextResponse.json({ error: 'teacherId è obbligatorio' }, { status: 400 });
    }

    // Verify student exists and belongs to tenant
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        tenantId: session.user.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Studente non trovato' }, { status: 404 });
    }

    // Verify subject exists
    const subject = await prisma.subject.findFirst({
      where: {
        id: validatedData.subjectId,
        tenantId: session.user.tenantId,
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
    }

    // Verify class exists
    const classEntity = await prisma.class.findFirst({
      where: {
        id: validatedData.classId,
        tenantId: session.user.tenantId,
      },
    });

    if (!classEntity) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // Create the grade
    const grade = await prisma.grade.create({
      data: {
        ...validatedData,
        teacherId,
        tenantId: session.user.tenantId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            // SECURITY: parentUserId removed from response (BUG-014 fix)
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
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create notification for parent if student has a parent
    if (student.parentUserId) {
      try {
        await prisma.notification.create({
          data: {
            tenantId: session.user.tenantId,
            userId: student.parentUserId,
            title: 'Nuovo voto registrato',
            content: `${student.firstName} ha ricevuto un voto ${grade.value} in ${subject.name}`,
            type: 'GRADE',
            priority: 'NORMAL',
            sourceType: 'grade',
            sourceId: grade.id,
            actionUrl: `/dashboard/students/${student.id}`,
          },
        });
      } catch (notifError) {
        console.error('Notification creation failed:', notifError);
        // Don't fail the whole request for notification error
      }
    }

    return NextResponse.json(grade, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Grade POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
