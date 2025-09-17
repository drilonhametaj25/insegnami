import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/dashboard/parent - Get parent dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only PARENT role can access parent dashboard
    if (session.user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Forbidden - Parent access only' }, { status: 403 });
    }

    // Get all children for this parent
    const children = await prisma.student.findMany({
      where: {
        parentUserId: session.user.id,
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

    if (children.length === 0) {
      return NextResponse.json({ error: 'No children found for this parent' }, { status: 404 });
    }

    const childrenIds = children.map(child => child.id);

    // Get upcoming lessons for all children (next 7 days)
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
              studentId: {
                in: childrenIds,
              },
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
            StudentClass: {
              where: {
                studentId: {
                  in: childrenIds,
                },
              },
              include: {
                student: true,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 20,
    } as any);

    // Get attendance records for all children (last 30 days)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        tenantId: session.user.tenantId,
        studentId: {
          in: childrenIds,
        },
        recordedAt: {
          gte: monthAgo,
        },
      },
      include: {
        student: true,
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
      take: 50,
    } as any);

    // Get payments for all children
    const payments = await prisma.payment.findMany({
      where: {
        tenantId: session.user.tenantId,
        studentId: {
          in: childrenIds,
        },
      },
      include: {
        student: true,
      },
      orderBy: {
        dueDate: 'desc',
      },
      take: 30,
    } as any);

    // Get notices for parents
    const notices = await prisma.notice.findMany({
      where: {
        tenantId: session.user.tenantId,
        isPublic: true,
        targetRoles: {
          has: 'PARENT',
        },
      },
      orderBy: {
        publishAt: 'desc',
      },
      take: 15,
    });

    // Calculate stats for each child
    const childrenWithStats = children.map((child: any) => {
      // Get attendance for this child
      const childAttendance = attendanceRecords.filter(record => record.studentId === child.id);
      const totalAttendanceRecords = childAttendance.length;
      const presentRecords = childAttendance.filter(record => record.status === 'PRESENT').length;
      const attendanceRate = totalAttendanceRecords > 0 ? Math.round((presentRecords / totalAttendanceRecords) * 100) : 0;

      // Get next lesson for this child
      const childUpcomingLessons = upcomingLessons.filter((lesson: any) => 
        lesson.class.StudentClass.some((sc: any) => sc.studentId === child.id)
      );
      const nextLesson = childUpcomingLessons[0] || null;

      // Get classes for this child
      const childClasses = child.StudentClass?.map((sc: any) => ({
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
      })) || [];

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

        // Stats for this child
        stats: {
          activeCourses: childClasses.length,
          attendanceRate,
          totalLessons: totalAttendanceRecords,
        },

        // Data for this child
        classes: childClasses,
        nextLesson: nextLesson ? {
          id: nextLesson.id,
          title: nextLesson.title,
          startTime: nextLesson.startTime,
          endTime: nextLesson.endTime,
          teacher: `${(nextLesson as any).teacher.user.firstName} ${(nextLesson as any).teacher.user.lastName}`,
          course: (nextLesson as any).class.course?.name,
        } : null,
      };
    });

    // Overall stats for parent dashboard
    const totalActiveCourses = childrenWithStats.reduce((sum, child) => sum + child.stats.activeCourses, 0);
    const averageAttendanceRate = childrenWithStats.length > 0 
      ? Math.round(childrenWithStats.reduce((sum, child) => sum + child.stats.attendanceRate, 0) / childrenWithStats.length) 
      : 0;
    const totalPendingPayments = payments.filter(p => p.status === 'PENDING').length;
    const totalUpcomingLessons = upcomingLessons.length;

    // Build dashboard data
    const dashboardData = {
      parent: {
        id: session.user.id,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: (session.user as any).email,
        phone: (session.user as any).phone,
      },

      // Overall statistics
      stats: {
        enrolledChildren: children.length,
        totalActiveCourses,
        averageAttendanceRate,
        totalUpcomingLessons,
        totalPendingPayments,
      },

      // Children with their individual stats
      children: childrenWithStats,

      // All upcoming lessons (for calendar)
      upcomingLessons: upcomingLessons.map((lesson: any) => {
        const enrolledChildren = lesson.class.StudentClass.map((sc: any) => ({
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
            name: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
            email: lesson.teacher.user.email,
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

      // All attendance records
      attendanceRecords: attendanceRecords.map((record: any) => ({
        id: record.id,
        status: record.status,
        recordedAt: record.recordedAt,
        notes: record.notes,
        child: {
          id: record.student.id,
          name: `${record.student.firstName} ${record.student.lastName}`,
        },
        lesson: {
          id: record.lesson.id,
          title: record.lesson.title,
          date: record.lesson.startTime,
          teacher: `${record.lesson.teacher.user.firstName} ${record.lesson.teacher.user.lastName}`,
          course: record.lesson.class.course?.name,
        },
      })),

      // All payments
      payments: payments.map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        dueDate: payment.dueDate,
        status: payment.status,
        paidAt: payment.paidAt,
        type: payment.type,
        child: {
          id: payment.student.id,
          name: `${payment.student.firstName} ${payment.student.lastName}`,
        },
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
    };

    return NextResponse.json({ success: true, data: dashboardData });

  } catch (error) {
    console.error('Error fetching parent dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
