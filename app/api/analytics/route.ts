import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const type = searchParams.get('type') || 'overview';

    // Get tenant ID (in production, get from session or middleware)
    const tenantId = '1'; // For demo purposes

    const endDate = new Date();
    const startDate = subDays(endDate, parseInt(period));

    switch (type) {
      case 'overview':
        return await getOverviewStats(tenantId, startDate, endDate);
      case 'attendance':
        return await getAttendanceStats(tenantId, startDate, endDate);
      case 'financial':
        return await getFinancialStats(tenantId, startDate, endDate);
      case 'trends':
        return await getTrendStats(tenantId, startDate, endDate);
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getOverviewStats(tenantId: string, startDate: Date, endDate: Date) {
  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    totalLessons,
    activeStudents,
    overduePayments,
    totalRevenue,
    attendanceRate
  ] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.teacher.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.class.count({ where: { tenantId, isActive: true } }),
    prisma.lesson.count({ 
      where: { 
        tenantId,
        startTime: { gte: startDate, lte: endDate }
      }
    }),
    prisma.student.count({ 
      where: { 
        tenantId,
        status: 'ACTIVE',
        updatedAt: { gte: subDays(endDate, 30) }
      }
    }),
    prisma.payment.count({ 
      where: { 
        tenantId,
        status: 'OVERDUE'
      }
    }),
    prisma.payment.aggregate({
      where: { 
        tenantId,
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    }),
    getAttendanceRateForPeriod(tenantId, startDate, endDate)
  ]);

  const revenueAmount = totalRevenue._sum.amount || 0;
  const stats = {
    totalStudents,
    totalTeachers,
    totalClasses,
    totalLessons,
    activeStudents,
    overduePayments,
    totalRevenue: Number(revenueAmount),
    attendanceRate: attendanceRate || 0,
    paymentRate: revenueAmount && totalStudents > 0 ? 
      ((Number(revenueAmount) / (totalStudents * 100)) * 100) : 0 // Simplified calculation
  };

  return NextResponse.json(stats);
}

async function getAttendanceStats(tenantId: string, startDate: Date, endDate: Date) {
  const attendance = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      lesson: {
        tenantId
      },
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: { status: true }
  });

  const dailyAttendance = await prisma.attendance.groupBy({
    by: ['createdAt'],
    where: {
      lesson: {
        tenantId
      },
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: { id: true }
  });

  // Format daily data for charts
  const dailyData = dailyAttendance.reduce((acc, item) => {
    const date = format(item.createdAt, 'yyyy-MM-dd');
    acc[date] = (acc[date] || 0) + (item._count?.id || 0);
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    byStatus: attendance,
    daily: dailyData,
    totalRecords: attendance.reduce((sum, item) => sum + (item._count?.status || 0), 0)
  });
}

async function getFinancialStats(tenantId: string, startDate: Date, endDate: Date) {
  const [payments, monthlyRevenue] = await Promise.all([
    prisma.payment.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: { status: true },
      _sum: { amount: true }
    }),
    prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })
  ]);

  // Format monthly revenue for charts
  const revenueData = monthlyRevenue.reduce((acc, item) => {
    const date = format(item.createdAt, 'yyyy-MM-dd');
    acc[date] = (acc[date] || 0) + Number(item._sum.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    byStatus: payments,
    dailyRevenue: revenueData,
    totalRevenue: payments.reduce((sum, item) => sum + Number(item._sum.amount || 0), 0)
  });
}

async function getTrendStats(tenantId: string, startDate: Date, endDate: Date) {
  // Get enrollment trends
  const enrollments = await prisma.student.groupBy({
    by: ['createdAt'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: { id: true }
  });

  // Get lesson trends
  const lessons = await prisma.lesson.groupBy({
    by: ['startTime'],
    where: {
      tenantId,
      startTime: { gte: startDate, lte: endDate }
    },
    _count: { id: true }
  });

  const enrollmentTrends = enrollments.reduce((acc, item) => {
    const date = format(item.createdAt, 'yyyy-MM-dd');
    acc[date] = (acc[date] || 0) + (item._count?.id || 0);
    return acc;
  }, {} as Record<string, number>);

  const lessonTrends = lessons.reduce((acc, item) => {
    const date = format(item.startTime, 'yyyy-MM-dd');
    acc[date] = (acc[date] || 0) + (item._count?.id || 0);
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    enrollments: enrollmentTrends,
    lessons: lessonTrends
  });
}

async function getAttendanceRateForPeriod(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const [present, total] = await Promise.all([
    prisma.attendance.count({
      where: {
        lesson: {
          tenantId
        },
        status: 'PRESENT',
        createdAt: { gte: startDate, lte: endDate }
      }
    }),
    prisma.attendance.count({
      where: {
        lesson: {
          tenantId
        },
        createdAt: { gte: startDate, lte: endDate }
      }
    })
  ]);

  return total > 0 ? (present / total) * 100 : 0;
}
