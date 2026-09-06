import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, getChildStudentIds } from '@/lib/api-auth';

// GET /api/dashboard/parent - Dashboard del genitore/tutore (multi-figlio)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ roles: ['PARENT'] });

    // Figli: StudentGuardian + fallback legacy Student.parentUserId
    const childIds = await getChildStudentIds(ctx);

    const children = childIds.length
      ? await prisma.student.findMany({
          where: {
            id: { in: childIds },
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
            classes: {
              include: {
                class: {
                  include: {
                    course: true,
                    teacher: {
                      select: { id: true, firstName: true, lastName: true, email: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { lastName: 'asc' },
        })
      : [];

    const childrenIds = children.map((child) => child.id);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Prossime lezioni di tutti i figli (7 giorni)
    const upcomingLessons = childrenIds.length
      ? await prisma.lesson.findMany({
          where: {
            tenantId: ctx.tenantId,
            startTime: { gte: now, lte: weekFromNow },
            class: {
              students: { some: { studentId: { in: childrenIds } } },
            },
          },
          include: {
            teacher: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            class: {
              include: {
                course: true,
                students: {
                  where: { studentId: { in: childrenIds } },
                  include: { student: true },
                },
              },
            },
          },
          orderBy: { startTime: 'asc' },
          take: 20,
        })
      : [];

    // Presenze ultimi 30 giorni: Attendance non ha tenantId, scoping via lesson
    const attendanceRecords = childrenIds.length
      ? await prisma.attendance.findMany({
          where: {
            studentId: { in: childrenIds },
            lesson: {
              tenantId: ctx.tenantId,
              startTime: { gte: monthAgo },
            },
          },
          include: {
            student: true,
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
          take: 50,
        })
      : [];

    const payments = childrenIds.length
      ? await prisma.payment.findMany({
          where: {
            tenantId: ctx.tenantId,
            studentId: { in: childrenIds },
          },
          include: { student: true },
          orderBy: { dueDate: 'desc' },
          take: 30,
        })
      : [];

    // Avvisi pubblicati e non scaduti destinati ai genitori
    const notices = await prisma.notice.findMany({
      where: {
        tenantId: ctx.tenantId,
        isPublic: true,
        targetRoles: { has: 'PARENT' },
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { isUrgent: 'desc' }, { publishAt: 'desc' }],
      take: 15,
    });

    // Statistiche per figlio
    const childrenWithStats = children.map((child) => {
      const childAttendance = attendanceRecords.filter((r) => r.studentId === child.id);
      const totalAttendanceRecords = childAttendance.length;
      const presentRecords = childAttendance.filter((r) => r.status === 'PRESENT').length;
      const attendanceRate =
        totalAttendanceRecords > 0
          ? Math.round((presentRecords / totalAttendanceRecords) * 100)
          : 0;

      const childUpcomingLessons = upcomingLessons.filter((lesson) =>
        lesson.class.students.some((sc) => sc.studentId === child.id)
      );
      const nextLesson = childUpcomingLessons[0] || null;

      const childClasses = child.classes.map((sc) => ({
        id: sc.class.id,
        name: sc.class.name,
        course: sc.class.course,
        teacher: {
          id: sc.class.teacher.id,
          name: `${sc.class.teacher.firstName} ${sc.class.teacher.lastName}`,
          email: sc.class.teacher.email,
        },
        enrolledAt: sc.enrolledAt,
      }));

      const childPayments = payments.filter((p) => p.studentId === child.id);

      return {
        id: child.id,
        studentCode: child.studentCode,
        firstName: child.firstName,
        lastName: child.lastName,
        email: child.email,
        phone: child.phone,
        dateOfBirth: child.dateOfBirth,
        status: child.status,
        enrollmentDate: child.enrollmentDate,
        user: child.user,

        stats: {
          activeCourses: childClasses.length,
          attendanceRate,
          totalLessons: totalAttendanceRecords,
          pendingPayments: childPayments.filter((p) => p.status === 'PENDING').length,
        },

        classes: childClasses,
        nextLesson: nextLesson
          ? {
              id: nextLesson.id,
              title: nextLesson.title,
              startTime: nextLesson.startTime,
              endTime: nextLesson.endTime,
              teacher: `${nextLesson.teacher.firstName} ${nextLesson.teacher.lastName}`,
              course: nextLesson.class.course?.name,
            }
          : null,
      };
    });

    const totalActiveCourses = childrenWithStats.reduce(
      (sum, child) => sum + child.stats.activeCourses,
      0
    );
    const averageAttendanceRate =
      childrenWithStats.length > 0
        ? Math.round(
            childrenWithStats.reduce((sum, child) => sum + child.stats.attendanceRate, 0) /
              childrenWithStats.length
          )
        : 0;
    const totalPendingPayments = payments.filter((p) => p.status === 'PENDING').length;

    const dashboardData = {
      parent: {
        id: ctx.userId,
        firstName: ctx.session.user.firstName ?? '',
        lastName: ctx.session.user.lastName ?? '',
        email: ctx.email,
      },

      stats: {
        enrolledChildren: children.length,
        totalActiveCourses,
        averageAttendanceRate,
        totalUpcomingLessons: upcomingLessons.length,
        totalPendingPayments,
      },

      children: childrenWithStats,

      upcomingLessons: upcomingLessons.map((lesson) => {
        const enrolledChildren = lesson.class.students.map((sc) => ({
          id: sc.student.id,
          name: `${sc.student.firstName} ${sc.student.lastName}`,
        }));

        return {
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
          enrolledChildren,
        };
      }),

      attendanceRecords: attendanceRecords.map((record) => ({
        id: record.id,
        status: record.status,
        recordedAt: record.createdAt,
        notes: record.notes,
        child: {
          id: record.student.id,
          name: `${record.student.firstName} ${record.student.lastName}`,
        },
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
        child: {
          id: payment.student.id,
          name: `${payment.student.firstName} ${payment.student.lastName}`,
        },
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
    };

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error fetching parent dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
