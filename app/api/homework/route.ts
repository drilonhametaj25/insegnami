import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

// Validation schema for creating homework
const homeworkSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  lessonId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  assignedDate: z.string().transform((val) => new Date(val)),
  dueDate: z.string().transform((val) => new Date(val)),
  attachments: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().optional().default(true),
});

// GET /api/homework - List all homework with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const teacherId = searchParams.get('teacherId');
    const lessonId = searchParams.get('lessonId');
    const upcoming = searchParams.get('upcoming');
    const past = searchParams.get('past');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause with tenant scoping
    const where: any = {};

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Role-based filtering
    if (session.user.role === 'PARENT') {
      // Parents see homework for their children's classes
      // Guardian-aware: StudentGuardian + fallback legacy parentUserId
      const children = await prisma.student.findMany({
        where: {
          tenantId: session.user.tenantId,
          OR: [
            { parentUserId: session.user.id },
            { guardians: { some: { userId: session.user.id } } },
          ],
        },
        include: {
          classes: { select: { classId: true } },
        },
      });
      const classIds = children.flatMap((c) => c.classes.map((cl) => cl.classId));
      where.classId = { in: classIds };
      where.isPublished = true;
    } else if (session.user.role === 'STUDENT') {
      // Students see homework for their classes
      const student = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
        include: {
          classes: { select: { classId: true } },
        },
      });
      if (!student) {
        return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } });
      }
      where.classId = { in: student.classes.map((c) => c.classId) };
      where.isPublished = true;
    } else if (session.user.role === 'TEACHER') {
      // Teachers see homework they created
      // Deny-by-default: senza profilo Teacher risolvibile niente accesso
      const teacher = session.user.email
        ? await prisma.teacher.findFirst({
            where: {
              email: session.user.email,
              tenantId: session.user.tenantId,
            },
          })
        : null;
      if (!teacher) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Forzato sempre, anche con ?classId=
      where.teacherId = teacher.id;
    }

    // Additional filters
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    // ?teacherId= riservato agli admin: i non-admin restano sul proprio scope
    if (teacherId && isAdminRole(session.user.role)) where.teacherId = teacherId;
    if (lessonId) where.lessonId = lessonId;
    if (upcoming === 'true') {
      where.dueDate = { gte: new Date() };
    }
    if (past === 'true') {
      where.dueDate = { lt: new Date() };
    }

    const [homework, total] = await Promise.all([
      prisma.homework.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              name: true,
              code: true,
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
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.homework.count({ where }),
    ]);

    return NextResponse.json({
      data: homework,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + homework.length < total,
      },
    });
  } catch (error) {
    console.error('Homework GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/homework - Create new homework
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only ADMIN and TEACHER can create homework
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = homeworkSchema.parse(body);

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

    // Se il teacherId non è specificato (es. admin), usa il docente
    // assegnato alla classe come default.
    if (!teacherId) {
      teacherId = classEntity.teacherId;
    }
    if (!teacherId) {
      return NextResponse.json(
        { error: 'Nessun docente disponibile: assegna un docente alla classe o specificane uno.' },
        { status: 400 }
      );
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

    // Create the homework
    const homework = await prisma.homework.create({
      data: {
        tenantId: session.user.tenantId,
        classId: validatedData.classId,
        subjectId: validatedData.subjectId,
        teacherId,
        lessonId: validatedData.lessonId,
        title: validatedData.title,
        description: validatedData.description,
        assignedDate: validatedData.assignedDate,
        dueDate: validatedData.dueDate,
        attachments: validatedData.attachments,
        isPublished: validatedData.isPublished,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
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
      },
    });

    // Create notifications for students and parents
    if (validatedData.isPublished) {
      const students = await prisma.studentClass.findMany({
        where: { classId: validatedData.classId },
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              parentUserId: true,
              firstName: true,
            },
          },
        },
      });

      const notifications = [];
      for (const sc of students) {
        // Notify student
        if (sc.student.userId) {
          notifications.push({
            tenantId: session.user.tenantId,
            userId: sc.student.userId,
            title: 'Nuovo compito assegnato',
            content: `${subject.name}: ${validatedData.title} - Scadenza: ${validatedData.dueDate.toLocaleDateString('it-IT')}`,
            type: 'CALENDAR' as const,
            priority: 'NORMAL' as const,
            sourceType: 'homework',
            sourceId: homework.id,
            actionUrl: `/dashboard/homework/${homework.id}`,
          });
        }
        // Notify parent
        if (sc.student.parentUserId) {
          notifications.push({
            tenantId: session.user.tenantId,
            userId: sc.student.parentUserId,
            title: 'Nuovo compito assegnato',
            content: `${sc.student.firstName} - ${subject.name}: ${validatedData.title}`,
            type: 'CALENDAR' as const,
            priority: 'NORMAL' as const,
            sourceType: 'homework',
            sourceId: homework.id,
            actionUrl: `/dashboard/homework/${homework.id}`,
          });
        }
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    }

    return NextResponse.json(homework, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Homework POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
