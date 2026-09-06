import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError } from '@/lib/api-auth';

// GET /api/dashboard/student - Dashboard dello studente autenticato
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ roles: ['STUDENT'] });

    // Risoluzione studente via FK Student.userId, sempre scoped per tenant
    const student = await prisma.student.findFirst({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        parentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        classes: {
          include: {
            class: {
              include: {
                course: true,
                teacher: {
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
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Profilo studente non trovato per questo account' },
        { status: 404 }
      );
    }

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const classIds = student.classes.map((sc) => sc.classId);

    // Prossime lezioni (7 giorni)
    const upcomingLessons = await prisma.lesson.findMany({
      where: {
        tenantId: ctx.tenantId,
        startTime: { gte: now, lte: weekFromNow },
        class: {
          students: { some: { studentId: student.id } },
        },
      },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        class: { include: { course: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    });

    // Presenze ultimi 30 giorni: Attendance non ha tenantId, si scopa via lesson
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        studentId: student.id,
        lesson: {
          tenantId: ctx.tenantId,
          startTime: { gte: monthAgo },
        },
      },
      include: {
        lesson: {
          include: {
            teacher: {
              select: { id: true, firstName: true, lastName: true },
            },
            class: { include: { course: true } },
          },
        },
      },
      orderBy: { lesson: { startTime: 'desc' } },
    });

    const totalAttendanceRecords = attendanceRecords.length;
    const presentRecords = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const attendanceRate =
      totalAttendanceRecords > 0
        ? Math.round((presentRecords / totalAttendanceRecords) * 100)
        : 0;

    const payments = await prisma.payment.findMany({
      where: {
        tenantId: ctx.tenantId,
        studentId: student.id,
      },
      orderBy: { dueDate: 'desc' },
      take: 20,
    });

    // Avvisi pubblicati e non scaduti destinati agli studenti
    const notices = await prisma.notice.findMany({
      where: {
        tenantId: ctx.tenantId,
        isPublic: true,
        targetRoles: { has: 'STUDENT' },
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { isUrgent: 'desc' }, { publishAt: 'desc' }],
      take: 10,
    });

    const homework = await prisma.homework.findMany({
      where: {
        tenantId: ctx.tenantId,
        classId: { in: classIds },
        isPublished: true,
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: {
          select: {
            id: true,
            name: true,
            course: { select: { name: true } },
          },
        },
        submissions: {
          where: { studentId: student.id },
          select: {
            id: true,
            submittedAt: true,
            grade: true,
            feedback: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    // Pacchetti ore attivi (campi reali: totalHours/remainingHours/expiryDate)
    const hoursPackages = await prisma.hoursPackage.findMany({
      where: {
        tenantId: ctx.tenantId,
        studentId: student.id,
        isActive: true,
      },
      include: {
        course: { select: { id: true, name: true, level: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Conteggio lezioni per classe (per la barra progresso)
    const lessonCounts = await prisma.lesson.groupBy({
      by: ['classId'],
      where: {
        tenantId: ctx.tenantId,
        classId: { in: classIds },
      },
      _count: { id: true },
    });
    const lessonCountMap = new Map(lessonCounts.map((lc) => [lc.classId, lc._count.id]));

    const classAttendance = await prisma.attendance.findMany({
      where: {
        studentId: student.id,
        status: 'PRESENT',
        lesson: { tenantId: ctx.tenantId },
      },
      include: {
        lesson: { select: { classId: true } },
      },
    });

    const attendedByClass = new Map<string, number>();
    for (const att of classAttendance) {
      const classId = att.lesson?.classId;
      if (classId) {
        attendedByClass.set(classId, (attendedByClass.get(classId) || 0) + 1);
      }
    }

    const dashboardData = {
      student: {
        id: student.id,
        studentCode: student.studentCode,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth,
        status: student.status,
        enrollmentDate: student.enrollmentDate,
        user: student.user,
        parentUser: student.parentUser,
      },

      stats: {
        activeCourses: student.classes.length,
        attendanceRate,
        upcomingLessons: upcomingLessons.length,
        totalLessons: totalAttendanceRecords,
        pendingPayments: payments.filter((p) => p.status === 'PENDING').length,
      },

      classes: student.classes.map((sc) => {
        const totalLessons = lessonCountMap.get(sc.classId) || 0;
        const attendedLessons = attendedByClass.get(sc.classId) || 0;
        const progress =
          totalLessons > 0 ? Math.round((attendedLessons / totalLessons) * 100) : 0;

        return {
          id: sc.class.id,
          name: sc.class.name,
          course: sc.class.course,
          teacher: {
            id: sc.class.teacher.id,
            name: `${sc.class.teacher.firstName} ${sc.class.teacher.lastName}`,
            email: sc.class.teacher.email,
          },
          enrolledAt: sc.enrolledAt,
          progress,
          totalLessons,
          attendedLessons,
        };
      }),

      upcomingLessons: upcomingLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        status: lesson.status,
        teacher: {
          name: `${lesson.teacher.firstName} ${lesson.teacher.lastName}`,
          email: lesson.teacher.email,
        },
        class: {
          name: lesson.class.name,
          course: lesson.class.course?.name,
        },
        room: lesson.room,
        materials: lesson.materials,
      })),

      recentAttendance: attendanceRecords.slice(0, 10).map((record) => ({
        id: record.id,
        status: record.status,
        recordedAt: record.createdAt,
        notes: record.notes,
        lesson: {
          id: record.lesson.id,
          title: record.lesson.title,
          date: record.lesson.startTime,
          teacher: `${record.lesson.teacher.firstName} ${record.lesson.teacher.lastName}`,
          course: record.lesson.class.course?.name,
        },
      })),

      payments: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        dueDate: payment.dueDate,
        status: payment.status,
        paidDate: payment.paidDate,
      })),

      notices: notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        publishAt: notice.publishAt,
        isUrgent: notice.isUrgent,
        isPinned: notice.isPinned,
        targetRoles: notice.targetRoles,
      })),

      homework: homework.map((hw) => {
        const submission = hw.submissions[0];
        let status: 'pending' | 'submitted' | 'graded' = 'pending';
        if (submission) {
          status = submission.grade !== null ? 'graded' : 'submitted';
        }
        return {
          id: hw.id,
          title: hw.title,
          description: hw.description,
          course: hw.class?.course?.name || hw.subject?.name || 'N/A',
          subject: hw.subject?.name,
          className: hw.class?.name,
          dueDate: hw.dueDate,
          assignedDate: hw.assignedDate,
          status,
          grade: submission?.grade != null ? Number(submission.grade) : undefined,
          feedback: submission?.feedback,
          submittedAt: submission?.submittedAt,
        };
      }),

      hoursPackages: hoursPackages.map((pkg) => {
        const totalHours = Number(pkg.totalHours);
        const remainingHours = Number(pkg.remainingHours);
        const usedHours = Math.max(0, totalHours - remainingHours);
        const usedPercentage =
          totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0;
        const isLow = remainingHours <= totalHours * 0.2; // soglia 20%

        return {
          id: pkg.id,
          course: pkg.course,
          totalHours,
          usedHours,
          remainingHours,
          usedPercentage,
          isLow,
          expiryDate: pkg.expiryDate,
          isActive: pkg.isActive,
          purchaseDate: pkg.purchaseDate,
        };
      }),
    };

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error fetching student dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
