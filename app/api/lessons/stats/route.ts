import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    // Build where clause based on user role
    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (classId) {
      where.classId = classId;
    }

    // Role-based filtering
    if (session.user.role === 'TEACHER') {
      where.teacherId = session.user.id;
    } else if (session.user.role === 'STUDENT') {
      where.class = {
        students: {
          some: {
            student: {
              email: session.user.email,
            },
          },
        },
      };
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch various statistics
    const [
      total,
      scheduled,
      completed,
      cancelled,
      upcomingToday,
      allLessons,
    ] = await Promise.all([
      // Total lessons
      prisma.lesson.count({ where }),

      // Scheduled lessons
      prisma.lesson.count({
        where: {
          ...where,
          status: 'SCHEDULED',
        },
      }),

      // Completed lessons
      prisma.lesson.count({
        where: {
          ...where,
          status: 'COMPLETED',
        },
      }),

      // Cancelled lessons
      prisma.lesson.count({
        where: {
          ...where,
          status: 'CANCELLED',
        },
      }),

      // Upcoming today
      prisma.lesson.count({
        where: {
          ...where,
          startTime: {
            gte: today,
            lt: tomorrow,
          },
          status: 'SCHEDULED',
        },
      }),

      // All lessons with attendance for average calculation
      prisma.lesson.findMany({
        where: {
          ...where,
          status: 'COMPLETED',
        },
        include: {
          class: {
            include: {
              students: true,
            },
          },
          attendance: {
            where: {
              status: 'PRESENT',
            },
          },
        },
      }),
    ]);

    // Calculate average attendance
    let totalAttendanceRate = 0;
    let lessonsWithAttendance = 0;

    for (const lesson of allLessons) {
      const totalStudents = lesson.class.students.length;
      if (totalStudents > 0) {
        const presentCount = lesson.attendance.length;
        const attendanceRate = (presentCount / totalStudents) * 100;
        totalAttendanceRate += attendanceRate;
        lessonsWithAttendance++;
      }
    }

    const averageAttendance =
      lessonsWithAttendance > 0
        ? totalAttendanceRate / lessonsWithAttendance
        : 0;

    return NextResponse.json({
      total,
      scheduled,
      completed,
      cancelled,
      averageAttendance: Math.round(averageAttendance * 10) / 10,
      upcomingToday,
    });
  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
