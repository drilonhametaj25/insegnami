import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/parent-meetings/stats - Get meeting statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build base where clause
    const baseWhere: any = {};

    // Tenant scoping
    if (session.user.role !== 'SUPERADMIN') {
      baseWhere.tenantId = session.user.tenantId;
    }

    // Role-based filtering
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher) {
        return NextResponse.json({
          total: 0,
          requested: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          upcoming: 0,
          todayCount: 0,
          thisWeekCount: 0,
          thisMonthCount: 0,
        });
      }
      baseWhere.teacherId = teacher.id;
    } else if (session.user.role === 'PARENT') {
      const children = await prisma.student.findMany({
        where: {
          parentUserId: session.user.id,
          tenantId: session.user.tenantId,
        },
        select: { id: true },
      });
      if (children.length === 0) {
        return NextResponse.json({
          total: 0,
          requested: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          upcoming: 0,
          todayCount: 0,
          thisWeekCount: 0,
          thisMonthCount: 0,
        });
      }
      baseWhere.studentId = { in: children.map((c) => c.id) };
    }
    // ADMIN and SUPERADMIN see all

    // Date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Execute all queries in parallel
    const [
      total,
      requested,
      confirmed,
      completed,
      cancelled,
      upcoming,
      todayCount,
      thisWeekCount,
      thisMonthCount,
    ] = await Promise.all([
      // Total count
      prisma.parentMeeting.count({ where: baseWhere }),

      // Count by status
      prisma.parentMeeting.count({
        where: { ...baseWhere, status: 'REQUESTED' },
      }),
      prisma.parentMeeting.count({
        where: { ...baseWhere, status: 'CONFIRMED' },
      }),
      prisma.parentMeeting.count({
        where: { ...baseWhere, status: 'COMPLETED' },
      }),
      prisma.parentMeeting.count({
        where: { ...baseWhere, status: 'CANCELLED' },
      }),

      // Upcoming meetings (confirmed and in the future)
      prisma.parentMeeting.count({
        where: {
          ...baseWhere,
          status: 'CONFIRMED',
          date: { gte: now },
        },
      }),

      // Today's meetings
      prisma.parentMeeting.count({
        where: {
          ...baseWhere,
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          date: { gte: todayStart, lt: todayEnd },
        },
      }),

      // This week's meetings
      prisma.parentMeeting.count({
        where: {
          ...baseWhere,
          status: { in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] },
          date: { gte: weekStart, lt: weekEnd },
        },
      }),

      // This month's meetings
      prisma.parentMeeting.count({
        where: {
          ...baseWhere,
          status: { in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] },
          date: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    // Get recent meetings for quick view
    const recentMeetings = await prisma.parentMeeting.findMany({
      where: {
        ...baseWhere,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        date: { gte: now },
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: 'asc' },
      take: 5,
    });

    // For ADMIN: get stats by teacher
    let byTeacher: any[] = [];
    if (['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      const teacherStats = await prisma.parentMeeting.groupBy({
        by: ['teacherId'],
        where: baseWhere,
        _count: { id: true },
      });

      if (teacherStats.length > 0) {
        const teacherIds = teacherStats.map((t) => t.teacherId);
        const teachers = await prisma.teacher.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, firstName: true, lastName: true },
        });

        byTeacher = teacherStats.map((stat) => {
          const teacher = teachers.find((t) => t.id === stat.teacherId);
          return {
            teacherId: stat.teacherId,
            teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown',
            count: stat._count.id,
          };
        }).sort((a, b) => b.count - a.count);
      }
    }

    return NextResponse.json({
      total,
      requested,
      confirmed,
      completed,
      cancelled,
      upcoming,
      todayCount,
      thisWeekCount,
      thisMonthCount,
      recentMeetings,
      ...(byTeacher.length > 0 && { byTeacher }),
    });
  } catch (error) {
    console.error('Parent meetings stats GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
