import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';

// Dashboard stats service
export class DashboardService {
  // Get admin dashboard stats
  static async getAdminStats(tenantId: string) {
    const [
      totalStudents,
      totalTeachers, 
      totalClasses,
      activeClasses,
      totalRevenue,
      pendingPayments,
      recentEnrollments,
      attendanceRate
    ] = await Promise.all([
      // Total students count
      prisma.student.count({
        where: { tenantId, status: 'ACTIVE' }
      }),
      
      // Total teachers count
      prisma.teacher.count({
        where: { tenantId, status: 'ACTIVE' }
      }),
      
      // Total classes count
      prisma.class.count({
        where: { tenantId }
      }),
      
      // Active classes count
      prisma.class.count({
        where: { 
          tenantId,
          isActive: true,
          endDate: { gte: new Date() }
        }
      }),
      
      // Total revenue from paid payments
      prisma.payment.aggregate({
        where: { 
          tenantId,
          status: 'PAID'
        },
        _sum: { amount: true }
      }),
      
      // Pending payments amount
      prisma.payment.aggregate({
        where: { 
          tenantId,
          status: 'PENDING'
        },
        _sum: { amount: true }
      }),
      
      // Recent enrollments (last 30 days)
      prisma.studentClass.count({
        where: {
          student: { tenantId },
          enrolledAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Calculate overall attendance rate
      prisma.attendance.aggregate({
        where: {
          student: { tenantId },
          status: { in: ['PRESENT', 'LATE'] }
        },
        _count: { id: true }
      }).then(async (present) => {
        const total = await prisma.attendance.count({
          where: { student: { tenantId } }
        });
        return total > 0 ? Math.round((present._count.id / total) * 100) : 0;
      })
    ]);

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      activeClasses,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingPayments: pendingPayments._sum.amount || 0,
      recentEnrollments,
      attendanceRate
    };
  }

  // Get teacher dashboard stats
  static async getTeacherStats(teacherId: string, tenantId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, tenantId }
    });

    if (!teacher) return null;

    const [
      myClasses,
      myStudents,
      todayLessons,
      weekLessons,
      avgAttendance
    ] = await Promise.all([
      // Classes assigned to this teacher
      prisma.class.count({
        where: { teacherId: teacher.id, tenantId }
      }),
      
      // Students in teacher's classes
      prisma.studentClass.count({
        where: {
          class: { teacherId: teacher.id, tenantId }
        }
      }),
      
      // Today's lessons
      prisma.lesson.count({
        where: {
          teacherId: teacher.id,
          tenantId,
          startTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      
      // This week's lessons
      prisma.lesson.count({
        where: {
          teacherId: teacher.id,
          tenantId,
          startTime: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            lt: new Date()
          }
        }
      }),
      
      // Average attendance in teacher's classes
      prisma.attendance.aggregate({
        where: {
          lesson: { teacherId: teacher.id },
          student: { tenantId },
          status: { in: ['PRESENT', 'LATE'] }
        },
        _count: { id: true }
      }).then(async (present) => {
        const total = await prisma.attendance.count({
          where: {
            lesson: { teacherId: teacher.id },
            student: { tenantId }
          }
        });
        return total > 0 ? Math.round((present._count.id / total) * 100) : 0;
      })
    ]);

    return {
      myClasses,
      myStudents,
      todayLessons,
      weekLessons,
      avgAttendance,
      teacher
    };
  }

  // Get student dashboard stats  
  static async getStudentStats(userId: string, tenantId: string) {
    const student = await prisma.student.findFirst({
      where: { 
        email: {
          in: await prisma.user.findMany({
            where: { id: userId },
            select: { email: true }
          }).then(users => users.map(u => u.email))
        },
        tenantId 
      },
      include: {
        classes: {
          include: {
            class: {
              include: {
                course: true,
                teacher: true
              }
            }
          }
        }
      }
    });

    if (!student) return null;

    const [
      myClasses,
      nextLesson,
      myAttendance,
      pendingPayments,
      recentNotices
    ] = await Promise.all([
      // Student's active classes
      student.classes.length,
      
      // Next upcoming lesson
      prisma.lesson.findFirst({
        where: {
          class: {
            students: {
              some: { studentId: student.id }
            }
          },
          tenantId,
          startTime: { gte: new Date() }
        },
        include: {
          class: {
            include: {
              course: true,
              teacher: true
            }
          }
        },
        orderBy: { startTime: 'asc' }
      }),
      
      // Student's attendance rate
      prisma.attendance.aggregate({
        where: {
          studentId: student.id,
          status: { in: ['PRESENT', 'LATE'] }
        },
        _count: { id: true }
      }).then(async (present) => {
        const total = await prisma.attendance.count({
          where: { studentId: student.id }
        });
        return total > 0 ? Math.round((present._count.id / total) * 100) : 0;
      }),
      
      // Pending payments for student
      prisma.payment.findMany({
        where: {
          studentId: student.id,
          status: 'PENDING'
        },
        orderBy: { dueDate: 'asc' }
      }),
      
      // Recent notices
      prisma.notice.findMany({
        where: {
          tenantId,
          isPublic: true,
          targetRoles: { has: Role.STUDENT }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    return {
      myClasses,
      nextLesson,
      myAttendance,
      pendingPayments,
      recentNotices,
      student
    };
  }

  // Get parent dashboard stats
  static async getParentStats(userId: string, tenantId: string) {
    const parentEmail = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!parentEmail) return null;

    const children = await prisma.student.findMany({
      where: {
        parentEmail: parentEmail.email,
        tenantId
      },
      include: {
        classes: {
          include: {
            class: {
              include: {
                course: true,
                teacher: true
              }
            }
          }
        }
      }
    });

    if (children.length === 0) return null;

    const childrenIds = children.map(child => child.id);

    const [
      totalClasses,
      upcomingLessons,
      avgAttendance,
      totalPendingPayments,
      recentNotices
    ] = await Promise.all([
      // Total classes for all children
      prisma.studentClass.count({
        where: {
          studentId: { in: childrenIds },
          isActive: true
        }
      }),
      
      // Next lessons for all children
      prisma.lesson.findMany({
        where: {
          class: {
            students: {
              some: { studentId: { in: childrenIds } }
            }
          },
          tenantId,
          startTime: { gte: new Date() }
        },
        include: {
          class: {
            include: {
              course: true,
              teacher: true,
              students: {
                where: { studentId: { in: childrenIds } },
                include: { student: true }
              }
            }
          }
        },
        orderBy: { startTime: 'asc' },
        take: 10
      }),
      
      // Average attendance for all children
      prisma.attendance.aggregate({
        where: {
          studentId: { in: childrenIds },
          status: { in: ['PRESENT', 'LATE'] }
        },
        _count: { id: true }
      }).then(async (present) => {
        const total = await prisma.attendance.count({
          where: { studentId: { in: childrenIds } }
        });
        return total > 0 ? Math.round((present._count.id / total) * 100) : 0;
      }),
      
      // Total pending payments for all children
      prisma.payment.aggregate({
        where: {
          studentId: { in: childrenIds },
          status: 'PENDING'
        },
        _sum: { amount: true }
      }),
      
      // Recent notices for parents
      prisma.notice.findMany({
        where: {
          tenantId,
          isPublic: true,
          targetRoles: { has: Role.PARENT }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    return {
      children,
      totalClasses,
      upcomingLessons,
      avgAttendance,
      totalPendingPayments: totalPendingPayments._sum.amount || 0,
      recentNotices
    };
  }

  // Get recent activities for admin dashboard
  static async getRecentActivities(tenantId: string, limit: number = 10) {
    // This is a simplified version - in a real app you might want to create an audit log table
    const [
      recentEnrollments,
      recentPayments,
      recentNotices
    ] = await Promise.all([
      prisma.studentClass.findMany({
        where: {
          student: { tenantId }
        },
        include: {
          student: true,
          class: {
            include: {
              course: true
            }
          }
        },
        orderBy: { enrolledAt: 'desc' },
        take: 3
      }),
      
      prisma.payment.findMany({
        where: { tenantId },
        include: {
          student: true
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      
      prisma.notice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 4
      })
    ]);

    const activities = [
      ...recentEnrollments.map(enrollment => ({
        id: `enrollment-${enrollment.id}`,
        type: 'enrollment',
        description: `${enrollment.student.firstName} ${enrollment.student.lastName} enrolled in ${enrollment.class.course.name}`,
        timestamp: enrollment.enrolledAt,
        icon: '🎓'
      })),
      ...recentPayments.map(payment => ({
        id: `payment-${payment.id}`,
        type: 'payment',
        description: `Payment of €${payment.amount} from ${payment.student.firstName} ${payment.student.lastName} - ${payment.status}`,
        timestamp: payment.createdAt,
        icon: payment.status === 'PAID' ? '💰' : '⏳'
      })),
      ...recentNotices.map(notice => ({
        id: `notice-${notice.id}`,
        type: 'notice',
        description: `New ${notice.type.toLowerCase()}: ${notice.title}`,
        timestamp: notice.createdAt,
        icon: '📢'
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);

    return activities;
  }
}
