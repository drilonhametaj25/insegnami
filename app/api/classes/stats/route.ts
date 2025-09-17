import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    const user = session?.user;
    
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get class counts
    const [totalClasses, activeClasses, inactiveClasses] = await Promise.all([
      prisma.class.count({
        where: { tenantId }
      }),
      prisma.class.count({
        where: { 
          tenantId,
          isActive: true 
        }
      }),
      prisma.class.count({
        where: { 
          tenantId,
          isActive: false 
        }
      })
    ]);

    // Get total students enrolled across all classes
    const totalStudentEnrollments = await prisma.studentClass.count({
      where: {
        class: { tenantId },
        isActive: true
      }
    });

    // Get unique students count
    const uniqueStudentsResult = await prisma.studentClass.findMany({
      where: {
        class: { tenantId },
        isActive: true
      },
      select: {
        studentId: true
      },
      distinct: ['studentId']
    });
    const uniqueStudentsCount = uniqueStudentsResult.length;

    // Get total lessons count
    const totalLessons = await prisma.lesson.count({
      where: {
        class: { tenantId }
      }
    });

    // Get classes near capacity (>= 90% full)
    const classesWithCounts = await prisma.class.findMany({
      where: { 
        tenantId,
        isActive: true 
      },
      select: {
        id: true,
        maxStudents: true,
        _count: {
          select: {
            students: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    const classesNearCapacity = classesWithCounts.filter(cls => {
      const percentage = (cls._count.students / cls.maxStudents) * 100;
      return percentage >= 90;
    }).length;

    // Calculate average students per class
    const averageStudentsPerClass = totalClasses > 0 ? totalStudentEnrollments / totalClasses : 0;

    // Get monthly enrollment trends
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEnrollments = await prisma.studentClass.findMany({
      where: {
        class: { tenantId },
        enrolledAt: {
          gte: sixMonthsAgo
        }
      },
      select: {
        enrolledAt: true
      }
    });

    // Group enrollments by month
    const enrollmentsByMonth = monthlyEnrollments.reduce((acc: Record<string, number>, enrollment) => {
      const month = enrollment.enrolledAt.toISOString().substring(0, 7); // YYYY-MM format
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get class distribution by course level
    const levelDistribution = await prisma.class.findMany({
      where: { 
        tenantId,
        isActive: true 
      },
      include: {
        course: {
          select: {
            level: true
          }
        }
      }
    });

    const levelCounts = levelDistribution.reduce((acc, cls) => {
      const level = cls.course.level || 'Unknown';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get teacher workload
    const teacherWorkload = await prisma.class.groupBy({
      by: ['teacherId'],
      where: { 
        tenantId,
        isActive: true 
      },
      _count: {
        id: true
      },
      _sum: {
        maxStudents: true
      }
    });

    const teacherWorkloadWithNames = await Promise.all(
      teacherWorkload.map(async (tw) => {
        const teacher = await prisma.user.findUnique({
          where: { id: tw.teacherId },
          select: {
            firstName: true,
            lastName: true
          }
        });
        return {
          teacherId: tw.teacherId,
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown',
          classCount: tw._count.id,
          totalCapacity: tw._sum.maxStudents || 0
        };
      })
    );

    // Get attendance rates for active classes
    const attendanceStats = await prisma.attendance.groupBy({
      by: ['status'],
      where: {
        lesson: {
          class: { 
            tenantId,
            isActive: true 
          }
        }
      },
      _count: {
        id: true
      }
    });

    const totalAttendanceRecords = attendanceStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const presentRecords = attendanceStats.find(stat => stat.status === 'PRESENT')?._count.id || 0;
    const averageAttendanceRate = totalAttendanceRecords > 0 ? (presentRecords / totalAttendanceRecords) * 100 : 0;

    const stats = {
      total: totalClasses,
      active: activeClasses,
      inactive: inactiveClasses,
      totalStudents: uniqueStudentsCount,
      totalEnrollments: totalStudentEnrollments,
      averageStudentsPerClass: Math.round(averageStudentsPerClass * 100) / 100,
      totalLessons,
      classesNearCapacity,
      averageAttendanceRate: Math.round(averageAttendanceRate * 100) / 100,
      enrollmentsByMonth,
      levelDistribution: levelCounts,
      teacherWorkload: teacherWorkloadWithNames
    };

    logger.info('Class stats retrieved successfully', { tenantId, stats });

    return NextResponse.json(stats);

  } catch (error) {
    logger.error('Error getting class stats:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
