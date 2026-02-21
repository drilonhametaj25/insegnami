import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { DisciplinaryType, Severity } from '@prisma/client';

// Validation schema for creating disciplinary note
const disciplinaryNoteSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
  type: z.nativeEnum(DisciplinaryType).default('NOTE'),
  severity: z.nativeEnum(Severity).default('MEDIUM'),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  date: z.string().transform((val) => new Date(val)),
});

// GET /api/disciplinary-notes - List all disciplinary notes with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause with tenant scoping
    const where: any = {};

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Role-based filtering
    if (session.user.role === 'PARENT') {
      // Parents can only see their children's notes
      const children = await prisma.student.findMany({
        where: {
          parentUserId: session.user.id,
          tenantId: session.user.tenantId,
        },
        select: { id: true },
      });
      where.studentId = { in: children.map((c) => c.id) };
    } else if (session.user.role === 'STUDENT') {
      // Students can only see their own notes
      const student = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      });
      if (!student) {
        return NextResponse.json([]);
      }
      where.studentId = student.id;
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      // Teachers see notes they created or of their classes
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
        include: {
          classes: { select: { id: true } },
        },
      });
      if (teacher) {
        where.OR = [
          { teacherId: teacher.id },
          { classId: { in: teacher.classes.map((c) => c.id) } },
        ];
      }
    }

    // Additional filters
    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (resolved !== null && resolved !== undefined) {
      where.resolved = resolved === 'true';
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [notes, total] = await Promise.all([
      prisma.disciplinaryNote.findMany({
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
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.disciplinaryNote.count({ where }),
    ]);

    return NextResponse.json({
      data: notes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notes.length < total,
      },
    });
  } catch (error) {
    console.error('Disciplinary notes GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/disciplinary-notes - Create a new disciplinary note
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can create disciplinary notes
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = disciplinaryNoteSchema.parse(body);

    // Get teacher ID
    let teacherId = body.teacherId;
    if (session.user.role === 'TEACHER') {
      if (!session.user.email) {
        return NextResponse.json(
          { error: 'Email utente non disponibile' },
          { status: 400 }
        );
      }
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: 'Docente non trovato' },
          { status: 404 }
        );
      }
      teacherId = teacher.id;
    }

    if (!teacherId) {
      return NextResponse.json(
        { error: 'teacherId è obbligatorio' },
        { status: 400 }
      );
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        tenantId: session.user.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Studente non trovato' },
        { status: 404 }
      );
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

    // Create the disciplinary note
    const note = await prisma.disciplinaryNote.create({
      data: {
        tenantId: session.user.tenantId,
        studentId: validatedData.studentId,
        teacherId,
        classId: validatedData.classId,
        type: validatedData.type,
        severity: validatedData.severity,
        title: validatedData.title,
        description: validatedData.description,
        date: validatedData.date,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            parentUserId: true,
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

    // Create notification for parent
    if (student.parentUserId) {
      await prisma.notification.create({
        data: {
          tenantId: session.user.tenantId,
          userId: student.parentUserId,
          title: validatedData.type === 'POSITIVE'
            ? 'Nota positiva registrata'
            : 'Nota disciplinare registrata',
          content: `${student.firstName} ha ricevuto una ${
            validatedData.type === 'POSITIVE' ? 'nota positiva' : 'nota disciplinare'
          }: ${validatedData.title}`,
          type: 'DISCIPLINARY',
          priority: validatedData.severity === 'CRITICAL' ? 'URGENT' : 'NORMAL',
          sourceType: 'disciplinaryNote',
          sourceId: note.id,
          actionUrl: `/dashboard/students/${student.id}`,
        },
      });

      // Mark parent as notified
      await prisma.disciplinaryNote.update({
        where: { id: note.id },
        data: {
          parentNotified: true,
          parentNotifiedAt: new Date(),
        },
      });
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Disciplinary note POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
