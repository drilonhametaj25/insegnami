import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { getTeacherIdForUser, getStudentIdForUser, type AuthContext } from '@/lib/api-auth';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

const attendanceUpdateSchema = z.object({
  studentId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  hoursAttended: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

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

    // Only admins and teachers can update attendance
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = attendanceUpdateSchema.parse(body);
    const { id: lessonId } = await params;

    // Verify lesson exists and belongs to tenant
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        tenantId: session.user.tenantId,
      },
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Teachers can only update attendance for their own lessons
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

    // Verify student exists and is enrolled in the class
    const enrollment = await prisma.studentClass.findFirst({
      where: {
        studentId: validatedData.studentId,
        classId: lesson.classId,
        isActive: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Studente non iscritto a questa classe' },
        { status: 400 }
      );
    }

    // Calculate lesson duration in hours
    const lessonDurationMs = new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime();
    const lessonDurationHours = lessonDurationMs / (1000 * 60 * 60);

    // Determine hours attended
    let hoursAttended = validatedData.hoursAttended;
    
    // If not provided, use full duration for PRESENT, zero for ABSENT
    if (hoursAttended === null || hoursAttended === undefined) {
      if (validatedData.status === 'PRESENT') {
        hoursAttended = lessonDurationHours;
      } else if (validatedData.status === 'LATE') {
        // For late, default to half the duration if not specified
        hoursAttended = lessonDurationHours / 2;
      } else {
        hoursAttended = 0;
      }
    }

    // Upsert attendance record
    const attendance = await prisma.attendance.upsert({
      where: {
        lessonId_studentId: {
          lessonId: lessonId,
          studentId: validatedData.studentId,
        },
      },
      update: {
        status: validatedData.status,
        hoursAttended: hoursAttended ? new Decimal(hoursAttended) : null,
        notes: validatedData.notes,
      },
      create: {
        lessonId: lessonId,
        studentId: validatedData.studentId,
        status: validatedData.status,
        hoursAttended: hoursAttended ? new Decimal(hoursAttended) : null,
        notes: validatedData.notes,
      },
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
    });

    // NB: nessun decremento diretto di HoursPackage qui — l'UNICO punto di
    // consumo ore è consumeHoursForLesson (lib/hours/consume.ts), invocato
    // alla transizione della lezione a COMPLETED.
    return NextResponse.json(attendance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

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

    const { id: lessonId } = await params;

    // Verify lesson exists and belongs to tenant
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        tenantId: session.user.tenantId,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Check di ruolo sul registro presenze (dati nominativi):
    // admin → tutto; TEACHER → solo le proprie lezioni; STUDENT → solo il
    // proprio record; PARENT → 403 (Wave 2 filtrerà sui figli).
    let studentIdFilter: string | null = null;
    if (!['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(session.user.role)) {
      // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;

      if (session.user.role === 'TEACHER') {
        const tid = await getTeacherIdForUser(ctx);
        if (!tid || lesson.teacherId !== tid) {
          return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }
      } else if (session.user.role === 'STUDENT') {
        const sid = await getStudentIdForUser(ctx);
        if (!sid) {
          return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }
        studentIdFilter = sid;
      } else {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    // Get all attendance records for this lesson
    const attendance = await prisma.attendance.findMany({
      where: {
        lessonId: lessonId,
        ...(studentIdFilter ? { studentId: studentIdFilter } : {}),
      },
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
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
