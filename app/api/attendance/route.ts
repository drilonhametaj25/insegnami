import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getTeacherIdForUser, getStudentIdForUser, type AuthContext } from '@/lib/api-auth';

const attendanceSchema = z.object({
  lessonId: z.string().cuid(),
  studentId: z.string().cuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  notes: z.string().optional(),
  arrivedAt: z.string().datetime().optional(),
  leftAt: z.string().datetime().optional(),
});

/**
 * Notifica assenze registrate (best-effort): genitori/tutori + docente via
 * NotificationService → dispatcher. Chiamata SEMPRE dentro try/catch dal
 * POST: un errore di notifica non deve far fallire la registrazione.
 */
async function notifyAbsences(
  lesson: { id: string; tenantId: string; title: string; startTime: Date; teacherId: string },
  entries: Array<{ attendanceId: string; studentId: string }>,
) {
  if (entries.length === 0) return;
  const { NotificationService } = await import('@/lib/notification-service');
  const teacher = await prisma.teacher.findUnique({
    where: { id: lesson.teacherId },
    select: { userId: true },
  });
  for (const entry of entries) {
    const student = await prisma.student.findUnique({
      where: { id: entry.studentId },
      select: {
        firstName: true,
        lastName: true,
        parentUserId: true,
        guardians: { select: { userId: true } },
      },
    });
    if (!student) continue;
    // Guardian-aware: StudentGuardian + fallback legacy parentUserId
    const parentIds = Array.from(new Set([
      ...student.guardians.map((g) => g.userId),
      ...(student.parentUserId ? [student.parentUserId] : []),
    ]));
    await NotificationService.notifyStudentAbsence(
      lesson.tenantId,
      entry.attendanceId,
      `${student.firstName} ${student.lastName}`,
      lesson.title,
      lesson.startTime,
      parentIds,
      teacher?.userId ?? '',
    );
  }
}

const bulkAttendanceSchema = z.object({
  lessonId: z.string().cuid(),
  attendance: z.array(z.object({
    studentId: z.string().cuid(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    notes: z.string().optional(),
    arrivedAt: z.string().datetime().optional(),
    leftAt: z.string().datetime().optional(),
  })),
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const lessonId = searchParams.get('lessonId');
    const studentId = searchParams.get('studentId');
    const classId = searchParams.get('classId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      lesson: {
        tenantId: session.user.tenantId,
      },
    };

    if (lessonId) where.lessonId = lessonId;
    if (studentId) where.studentId = studentId;
    if (classId) {
      where.lesson = {
        ...where.lesson,
        classId,
      };
    }

    if (startDate || endDate) {
      where.lesson = {
        ...where.lesson,
        startTime: {},
      };
      if (startDate) where.lesson.startTime.gte = new Date(startDate);
      if (endDate) where.lesson.startTime.lte = new Date(endDate);
    }

    // Role-based filtering
    // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
    // Resolving via getTeacherIdForUser also enforces tenantId scope.
    const ctx = {
      userId: session.user.id ?? '',
      tenantId: session.user.tenantId,
      role: session.user.role,
      email: session.user.email ?? '',
      isSuperAdmin: session.user.role === 'SUPERADMIN',
      session,
    } as AuthContext;

    if (session.user.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      // If user has no Teacher record in this tenant, return empty result set.
      where.lesson = {
        ...where.lesson,
        teacherId: teacherId ?? '__no_teacher__',
      };
    } else if (session.user.role === 'STUDENT') {
      const studentId = await getStudentIdForUser(ctx);
      where.studentId = studentId ?? '__no_student__';
    } else if (session.user.role === 'PARENT') {
      // Parents can only see their children's attendance
      // Guardian-aware: StudentGuardian + fallback legacy parentUserId
      where.student = {
        OR: [
          { parentUserId: session.user.id },
          { guardians: { some: { userId: session.user.id } } },
        ],
      };
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  course: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
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
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentCode: true,
            },
          },
        },
        orderBy: { lesson: { startTime: 'desc' } },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      attendance,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
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

    // Registrazione presenze: admin, direzione, segreteria e docenti
    if (!['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();

    // Check if it's bulk attendance or single attendance
    const isBulk = Array.isArray(body.attendance);
    
    // SECURITY: Lesson.teacherId references Teacher.id, NOT User.id.
    const ctx = {
      userId: session.user.id ?? '',
      tenantId: session.user.tenantId,
      role: session.user.role,
      email: session.user.email ?? '',
      isSuperAdmin: session.user.role === 'SUPERADMIN',
      session,
    } as AuthContext;
    const teacherId = session.user.role === 'TEACHER' ? await getTeacherIdForUser(ctx) : null;
    if (session.user.role === 'TEACHER' && !teacherId) {
      return NextResponse.json({ error: 'Teacher record not found' }, { status: 403 });
    }

    if (isBulk) {
      const validatedData = bulkAttendanceSchema.parse(body);

      // Verify lesson belongs to tenant and teacher (if teacher role)
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: validatedData.lessonId,
          tenantId: session.user.tenantId,
          ...(teacherId && { teacherId }),
        },
      });

      if (!lesson) {
        return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
      }

      // Verify all students belong to the class
      const classStudents = await prisma.studentClass.findMany({
        where: {
          classId: lesson.classId,
          studentId: {
            in: validatedData.attendance.map(a => a.studentId),
          },
        },
      });

      if (classStudents.length !== validatedData.attendance.length) {
        return NextResponse.json(
          { error: 'Alcuni studenti non appartengono a questa classe' },
          { status: 400 }
        );
      }

      // Create or update attendance records
      const attendanceRecords = await Promise.all(
        validatedData.attendance.map(async (attendanceData) => {
          return prisma.attendance.upsert({
            where: {
              lessonId_studentId: {
                lessonId: validatedData.lessonId,
                studentId: attendanceData.studentId,
              },
            },
            update: {
              status: attendanceData.status,
              notes: attendanceData.notes,
              arrivedAt: attendanceData.arrivedAt ? new Date(attendanceData.arrivedAt) : null,
              leftAt: attendanceData.leftAt ? new Date(attendanceData.leftAt) : null,
            },
            create: {
              lessonId: validatedData.lessonId,
              studentId: attendanceData.studentId,
              status: attendanceData.status,
              notes: attendanceData.notes,
              arrivedAt: attendanceData.arrivedAt ? new Date(attendanceData.arrivedAt) : null,
              leftAt: attendanceData.leftAt ? new Date(attendanceData.leftAt) : null,
            },
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  studentCode: true,
                },
              },
            },
          });
        })
      );

      // Notifica assenze (in try/catch: non blocca la risposta)
      try {
        await notifyAbsences(
          lesson,
          attendanceRecords
            .filter((r) => r.status === 'ABSENT')
            .map((r) => ({ attendanceId: r.id, studentId: r.studentId })),
        );
      } catch (notifyError) {
        console.error('Errore notifica assenze (bulk):', notifyError);
      }

      return NextResponse.json(attendanceRecords, { status: 201 });
    } else {
      // Single attendance record
      const validatedData = attendanceSchema.parse(body);

      // Verify lesson belongs to tenant and teacher (if teacher role)
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: validatedData.lessonId,
          tenantId: session.user.tenantId,
          ...(teacherId && { teacherId }),
        },
      });

      if (!lesson) {
        return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
      }

      // Verify student belongs to the class
      const studentClass = await prisma.studentClass.findFirst({
        where: {
          classId: lesson.classId,
          studentId: validatedData.studentId,
        },
      });

      if (!studentClass) {
        return NextResponse.json(
          { error: 'Lo studente non appartiene a questa classe' },
          { status: 400 }
        );
      }

      const attendance = await prisma.attendance.upsert({
        where: {
          lessonId_studentId: {
            lessonId: validatedData.lessonId,
            studentId: validatedData.studentId,
          },
        },
        update: {
          status: validatedData.status,
          notes: validatedData.notes,
          arrivedAt: validatedData.arrivedAt ? new Date(validatedData.arrivedAt) : null,
          leftAt: validatedData.leftAt ? new Date(validatedData.leftAt) : null,
        },
        create: {
          lessonId: validatedData.lessonId,
          studentId: validatedData.studentId,
          status: validatedData.status,
          notes: validatedData.notes,
          arrivedAt: validatedData.arrivedAt ? new Date(validatedData.arrivedAt) : null,
          leftAt: validatedData.leftAt ? new Date(validatedData.leftAt) : null,
        },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentCode: true,
            },
          },
        },
      });

      // Notifica assenza (in try/catch: non blocca la risposta)
      if (validatedData.status === 'ABSENT') {
        try {
          await notifyAbsences(lesson, [
            { attendanceId: attendance.id, studentId: validatedData.studentId },
          ]);
        } catch (notifyError) {
          console.error('Errore notifica assenza:', notifyError);
        }
      }

      return NextResponse.json(attendance, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating/updating attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
