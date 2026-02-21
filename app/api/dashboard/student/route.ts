import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/dashboard/student - Get student dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only STUDENT role can access student dashboard
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Forbidden - Student access only' }, { status: 403 });
    }

    // Get student record
    const student = await prisma.student.findFirst({
      where: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
      } as any,
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
        // Include student classes and lessons
        StudentClass: {
          include: {
            class: {
              include: {
                course: true,
                teacher: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      } as any,
    });

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    // Get upcoming lessons for this student (next 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const upcomingLessons = await prisma.lesson.findMany({
      where: {
        tenantId: session.user.tenantId,
        startTime: {
          gte: now,
          lte: weekFromNow,
        },
        class: {
          StudentClass: {
            some: {
              studentId: student.id,
            },
          },
        },
      },
      include: {
        teacher: {
          include: {
            user: true,
          },
        },
        class: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 10,
    } as any);

    // Get attendance records for this student (last 30 days)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        tenantId: session.user.tenantId,
        studentId: student.id,
        recordedAt: {
          gte: monthAgo,
        },
      },
      include: {
        lesson: {
          include: {
            teacher: {
              include: {
                user: true,
              },
            },
            class: {
              include: {
                course: true,
              },
            },
          },
        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
    } as any);

    // Calculate attendance rate
    const totalAttendanceRecords = attendanceRecords.length;
    const presentRecords = attendanceRecords.filter(record => record.status === 'PRESENT').length;
    const attendanceRate = totalAttendanceRecords > 0 ? Math.round((presentRecords / totalAttendanceRecords) * 100) : 0;

    // Get student payments
    const payments = await prisma.payment.findMany({
      where: {
        tenantId: session.user.tenantId,
        studentId: student.id,
      },
      orderBy: {
        dueDate: 'desc',
      },
      take: 20,
    } as any);

    // Get notices for students
    const notices = await prisma.notice.findMany({
      where: {
        tenantId: session.user.tenantId,
        isPublic: true,
        targetRoles: {
          has: 'STUDENT',
        },
      },
      orderBy: {
        publishAt: 'desc',
      },
      take: 10,
    });

    // Get homework/assignments for this student
    const classIds = (student as any).StudentClass?.map((sc: any) => sc.class.id) || [];
    const homework = await prisma.homework.findMany({
      where: {
        tenantId: session.user.tenantId,
        classId: { in: classIds },
        isPublished: true,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            course: {
              select: {
                name: true,
              },
            },
          },
        },
        submissions: {
          where: {
            studentId: student.id,
          },
          select: {
            id: true,
            submittedAt: true,
            grade: true,
            feedback: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 20,
    });

    // Get total lesson counts per class for progress calculation
    const lessonCounts = await prisma.lesson.groupBy({
      by: ['classId'],
      where: {
        tenantId: session.user.tenantId,
        classId: { in: classIds },
      },
      _count: {
        id: true,
      },
    });

    const lessonCountMap = new Map(lessonCounts.map(lc => [lc.classId, lc._count.id]));

    // Get class-wise attendance from actual attendance records
    const classAttendance = await prisma.attendance.findMany({
      where: {
        studentId: student.id,
        status: 'PRESENT',
        lesson: {
          tenantId: session.user.tenantId,
        },
      },
      include: {
        lesson: {
          select: {
            classId: true,
          },
        },
      },
    });

    const attendedByClass = new Map<string, number>();
    for (const att of classAttendance) {
      const classId = att.lesson?.classId;
      if (classId) {
        attendedByClass.set(classId, (attendedByClass.get(classId) || 0) + 1);
      }
    }

    // Build dashboard data
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

      // Statistics
      stats: {
        activeCourses: (student as any).StudentClass?.length || 0,
        attendanceRate,
        upcomingLessons: upcomingLessons.length,
        totalLessons: attendanceRecords.length,
        pendingPayments: payments.filter(p => p.status === 'PENDING').length,
      },

      // Classes and courses with progress
      classes: (student as any).StudentClass?.map((sc: any) => {
        const totalLessons = lessonCountMap.get(sc.class.id) || 0;
        const attendedLessons = attendedByClass.get(sc.class.id) || 0;
        const progress = totalLessons > 0 ? Math.round((attendedLessons / totalLessons) * 100) : 0;

        return {
          id: sc.class.id,
          name: sc.class.name,
          description: sc.class.description,
          schedule: sc.class.schedule,
          course: sc.class.course,
          teacher: {
            id: sc.class.teacher.id,
            name: `${sc.class.teacher.user.firstName} ${sc.class.teacher.user.lastName}`,
            email: sc.class.teacher.user.email,
          },
          enrolledAt: sc.enrolledAt,
          progress,
          totalLessons,
          attendedLessons,
        };
      }) || [],

      // Upcoming lessons
      upcomingLessons: upcomingLessons.map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        status: lesson.status,
        teacher: {
          name: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
          email: lesson.teacher.user.email,
        },
        class: {
          name: lesson.class.name,
          course: lesson.class.course?.name,
        },
        room: lesson.room,
        materials: lesson.materials,
      })),

      // Recent attendance
      recentAttendance: attendanceRecords.slice(0, 10).map((record: any) => ({
        id: record.id,
        status: record.status,
        recordedAt: record.recordedAt,
        notes: record.notes,
        lesson: {
          id: record.lesson.id,
          title: record.lesson.title,
          date: record.lesson.startTime,
          teacher: `${record.lesson.teacher.user.firstName} ${record.lesson.teacher.user.lastName}`,
          course: record.lesson.class.course?.name,
        },
      })),

      // Payments
      payments: payments.map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        dueDate: payment.dueDate,
        status: payment.status,
        paidAt: payment.paidAt,
        type: payment.type,
      })),

      // Notices
      notices: notices.map(notice => ({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        publishAt: notice.publishAt,
        isUrgent: notice.isUrgent,
        isPinned: notice.isPinned,
        targetRoles: notice.targetRoles,
      })),

      // Homework/Assignments
      homework: homework.map((hw: any) => {
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
          grade: submission?.grade,
          feedback: submission?.feedback,
          submittedAt: submission?.submittedAt,
        };
      }),
    };

    return NextResponse.json({ success: true, data: dashboardData });

  } catch (error) {
    console.error('Error fetching student dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
