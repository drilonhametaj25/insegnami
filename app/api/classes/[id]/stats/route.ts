import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/classes/[id]/stats - Get statistics for a specific class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify class exists and user has access
    const classWhere: any = { id };
    if (session.user.role !== 'SUPERADMIN') {
      classWhere.tenantId = session.user.tenantId;
    }

    // For teachers, verify they teach this class
    if (session.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher) {
        classWhere.teacherId = teacher.id;
      }
    }

    const classData = await prisma.class.findFirst({
      where: classWhere,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            level: true,
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
        students: {
          where: { isActive: true },
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
        lessons: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            status: true,
          },
          orderBy: {
            startTime: 'desc',
          },
        },
        _count: {
          select: {
            students: {
              where: { isActive: true },
            },
            lessons: true,
          },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Calculate enrollment stats
    const currentStudents = classData._count.students;
    const maxStudents = classData.maxStudents;
    const enrollmentPercentage = Math.round((currentStudents / maxStudents) * 100);

    // Calculate lesson stats
    const totalLessons = classData._count.lessons;
    const completedLessons = classData.lessons.filter(l => l.status === 'COMPLETED').length;
    const upcomingLessons = classData.lessons.filter(l => l.status === 'SCHEDULED').length;
    const lessonCompletionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Get attendance statistics
    const attendanceStats = await prisma.attendance.groupBy({
      by: ['status'],
      where: {
        lesson: {
          classId: id,
        },
      },
      _count: {
        id: true,
      },
    });

    const totalAttendanceRecords = attendanceStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const presentRecords = attendanceStats.find(stat => stat.status === 'PRESENT')?._count.id || 0;
    const averageAttendanceRate = totalAttendanceRecords > 0 
      ? Math.round((presentRecords / totalAttendanceRecords) * 100) 
      : 0;

    // Get recent attendance by student
    const studentAttendance = await Promise.all(
      classData.students.map(async (enrollment) => {
        const studentAttendanceRecords = await prisma.attendance.groupBy({
          by: ['status'],
          where: {
            studentId: enrollment.student.id,
            lesson: {
              classId: id,
            },
          },
          _count: {
            id: true,
          },
        });

        const totalRecords = studentAttendanceRecords.reduce((sum, stat) => sum + stat._count.id, 0);
        const presentRecords = studentAttendanceRecords.find(stat => stat.status === 'PRESENT')?._count.id || 0;
        const attendancePercentage = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

        return {
          student: enrollment.student,
          totalLessons: totalRecords,
          attendancePercentage,
          lastAttendance: null, // Could be enhanced with last attendance date
        };
      })
    );

    // Calculate performance trends (mock data for now)
    const performanceTrend = [
      { period: '6 months ago', value: 85 },
      { period: '5 months ago', value: 87 },
      { period: '4 months ago', value: 89 },
      { period: '3 months ago', value: 91 },
      { period: '2 months ago', value: 88 },
      { period: 'Last month', value: averageAttendanceRate },
    ];

    // Get upcoming lessons (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingLessonsDetail = await prisma.lesson.findMany({
      where: {
        classId: id,
        startTime: {
          gte: new Date(),
          lte: nextWeek,
        },
        status: 'SCHEDULED',
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        room: true,
        description: true,
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 5,
    });

    // Activity timeline (recent events)
    const recentActivity = [
      {
        id: '1',
        type: 'lesson',
        title: 'Lezione completata',
        description: 'Present Continuous Tense',
        date: new Date().toISOString(),
        icon: 'lesson',
      },
      {
        id: '2',
        type: 'enrollment',
        title: 'Nuovo studente iscritto',
        description: 'Mario Rossi si è iscritto al corso',
        date: new Date(Date.now() - 86400000).toISOString(),
        icon: 'user-plus',
      },
    ];

    const stats = {
      // Basic info
      class: {
        id: classData.id,
        name: classData.name,
        course: classData.course,
        teacher: classData.teacher,
        startDate: classData.startDate,
        endDate: classData.endDate,
      },

      // Enrollment statistics
      enrollment: {
        current: currentStudents,
        maximum: maxStudents,
        percentage: enrollmentPercentage,
        available: maxStudents - currentStudents,
      },

      // Lesson statistics
      lessons: {
        total: totalLessons,
        completed: completedLessons,
        upcoming: upcomingLessons,
        completionRate: lessonCompletionRate,
      },

      // Attendance statistics
      attendance: {
        averageRate: averageAttendanceRate,
        totalRecords: totalAttendanceRecords,
        breakdown: attendanceStats.reduce((acc, stat) => {
          acc[stat.status.toLowerCase()] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
      },

      // Student performance
      students: studentAttendance,

      // Performance trend
      performanceTrend,

      // Upcoming activities
      upcomingLessons: upcomingLessonsDetail,

      // Recent activity
      recentActivity,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Class stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
