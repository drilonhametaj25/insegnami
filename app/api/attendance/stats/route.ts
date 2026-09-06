import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError, getTeacherIdForUser } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Statistiche di scuola: ruoli espliciti (STUDENT/PARENT esclusi anche se
    // la matrice concede loro attendance:read — qui i dati sono aggregati di altri)
    const ctx = await requireAuth({ roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'] });

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Attendance non ha tenantId: lo scoping passa SEMPRE dalla lezione
    const whereConditions: any = {
      lesson: {
        tenantId: ctx.tenantId,
      },
    };

    if (classId) {
      whereConditions.lesson.classId = classId;
    }

    if (startDate && endDate) {
      whereConditions.lesson.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // I docenti vedono solo le statistiche delle proprie lezioni (deny se il
    // profilo Teacher non risolve)
    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      whereConditions.lesson.teacherId = teacherId;
    }

    // Get attendance stats
    const totalRecords = await prisma.attendance.count({
      where: whereConditions,
    });

    const presentRecords = await prisma.attendance.count({
      where: {
        ...whereConditions,
        status: 'PRESENT',
      },
    });

    const absentRecords = await prisma.attendance.count({
      where: {
        ...whereConditions,
        status: 'ABSENT',
      },
    });

    const lateRecords = await prisma.attendance.count({
      where: {
        ...whereConditions,
        status: 'LATE',
      },
    });

    const excusedRecords = await prisma.attendance.count({
      where: {
        ...whereConditions,
        status: 'EXCUSED',
      },
    });

    // Calculate percentages
    const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
    const absenteeRate = totalRecords > 0 ? Math.round((absentRecords / totalRecords) * 100) : 0;

    // Get attendance by class if no specific class is selected
    let attendanceByClass = null;
    if (!classId && ctx.role === 'ADMIN') {
      attendanceByClass = await prisma.attendance.groupBy({
        by: ['lessonId'],
        where: whereConditions,
        _count: {
          status: true,
        },
      });

      // Get lesson and class details for each group
      const lessonIds = attendanceByClass.map((item: any) => item.lessonId);
      const lessons = await prisma.lesson.findMany({
        where: {
          id: { in: lessonIds },
          tenantId: ctx.tenantId,
        },
        include: {
          class: {
            include: {
              course: true,
            },
          },
        },
      });

      attendanceByClass = attendanceByClass.map((item: any) => {
        const lessonData = lessons.find(l => l.id === item.lessonId);
        return {
          classId: lessonData?.class?.id,
          className: lessonData?.class?.name || 'Unknown',
          courseName: lessonData?.class?.course?.name || 'Unknown',
          totalRecords: item._count.status,
        };
      });
    }

    // Get recent attendance trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAttendance = await prisma.attendance.groupBy({
      by: ['createdAt'],
      where: {
        ...whereConditions,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: {
        status: true,
      },
    });

    const stats = {
      total: totalRecords,
      present: presentRecords,
      absent: absentRecords,
      late: lateRecords,
      excused: excusedRecords,
      attendanceRate,
      absenteeRate,
      attendanceByClass,
      recentTrend: recentAttendance,
    };

    return NextResponse.json(stats);

  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error fetching attendance stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
