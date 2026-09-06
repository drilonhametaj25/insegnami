import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getTeacherIdForUser, type AuthContext } from '@/lib/api-auth';
import { findLessonConflicts, conflictMessage } from '@/lib/lessons/conflicts';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

const lessonUpdateSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto').optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  room: z.string().optional(),
  // Materia opzionale (null per rimuoverla)
  subjectId: z.string().cuid().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  materials: z.string().optional(),
  homework: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    const lesson = await prisma.lesson.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
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
            students: {
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
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
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Role-based access control
    // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
    if (session.user.role === 'TEACHER') {
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;
      const tid = await getTeacherIdForUser(ctx);
      if (!tid || lesson.teacherId !== tid) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins and teachers can update lessons
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = lessonUpdateSchema.parse(body);
    const { id } = await params;

    // Check if lesson exists and belongs to tenant
    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingLesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Teachers can only update their own lessons
    // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
    if (session.user.role === 'TEACHER') {
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;
      const tid = await getTeacherIdForUser(ctx);
      if (!tid || existingLesson.teacherId !== tid) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    // Materia: se indicata deve appartenere allo stesso tenant
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

    // If updating times or room, check for conflicts (teacher + room).
    if (validatedData.startTime || validatedData.endTime || validatedData.room !== undefined) {
      const startTime = validatedData.startTime ? new Date(validatedData.startTime) : existingLesson.startTime;
      const endTime = validatedData.endTime ? new Date(validatedData.endTime) : existingLesson.endTime;
      const room = validatedData.room !== undefined ? validatedData.room : existingLesson.room;

      const conflicts = await findLessonConflicts({
        tenantId: session.user.tenantId,
        teacherId: existingLesson.teacherId,
        room,
        startTime,
        endTime,
        excludeLessonId: id,
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: conflictMessage(conflicts), conflicts },
          { status: 400 }
        );
      }
    }

    // Detect SCHEDULED → COMPLETED transition so we trigger hours-package
    // consumption AFTER the update commits. Doing it inside the same
    // $transaction guarantees: lesson.status flip + hoursConsumed flag flip
    // + HoursPackage.remainingHours decrements all succeed or all roll back.
    const willComplete =
      validatedData.status === 'COMPLETED' && existingLesson.status !== 'COMPLETED';

    // COMPLETED → CANCELLED: se le ore erano già state consumate va fatto
    // il refund (ledger-driven) nella stessa transazione dell'update.
    const willCancelCompleted =
      validatedData.status === 'CANCELLED' && existingLesson.status === 'COMPLETED';

    const updatedLesson = await prisma.$transaction(async (tx) => {
      const updated = await tx.lesson.update({
        where: { id: id },
        data: {
          ...validatedData,
          ...(validatedData.startTime && { startTime: new Date(validatedData.startTime) }),
          ...(validatedData.endTime && { endTime: new Date(validatedData.endTime) }),
        },
        include: {
          class: {
            include: {
              course: { select: { id: true, name: true, description: true } },
            },
          },
          teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
          attendance: {
            include: {
              student: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      if (willComplete) {
        const { consumeHoursForLesson } = await import('@/lib/hours/consume');
        await consumeHoursForLesson(id, tx);
      }

      if (willCancelCompleted && existingLesson.hoursConsumed) {
        const { refundHoursForLesson } = await import('@/lib/hours/consume');
        await refundHoursForLesson(id, tx);
      }

      return updated;
    });

    // Notifica cancellazione lezione (best-effort, DOPO il commit): studenti
    // iscritti + docente. Un errore qui non deve far fallire la PUT.
    if (willCancelCompleted) {
      try {
        const { NotificationService } = await import('@/lib/notification-service');
        const [enrolled, teacher] = await Promise.all([
          prisma.studentClass.findMany({
            where: { classId: existingLesson.classId, isActive: true },
            select: { student: { select: { userId: true } } },
          }),
          prisma.teacher.findUnique({
            where: { id: existingLesson.teacherId },
            select: { userId: true },
          }),
        ]);
        const studentUserIds = enrolled
          .map((e) => e.student.userId)
          .filter((uid): uid is string => Boolean(uid));
        await NotificationService.notifyLessonCancelled(
          existingLesson.tenantId,
          id,
          updatedLesson.title,
          updatedLesson.startTime,
          studentUserIds,
          teacher?.userId ?? undefined,
        );
      } catch (notifyErr) {
        console.error('Notifica cancellazione lezione fallita (non bloccante):', notifyErr);
      }
    }

    return NextResponse.json(updatedLesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating lesson:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins and teachers can delete lessons
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Check if lesson exists and belongs to tenant
    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingLesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Teachers can only delete their own lessons
    // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
    if (session.user.role === 'TEACHER') {
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;
      const tid = await getTeacherIdForUser(ctx);
      if (!tid || existingLesson.teacherId !== tid) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    // Delete lesson (this will cascade delete attendance records)
    await prisma.lesson.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Lezione eliminata con successo' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
