/**
 * Calcolo dati analytics condiviso tra GET /api/analytics (live) e
 * POST /api/reports (snapshot persistito in Report.data alla creazione).
 */

import { prisma } from '@/lib/db';
import { subDays, format } from 'date-fns';

export type AnalyticsType = 'overview' | 'attendance' | 'financial' | 'trends';

/** Mappa Report.type → tipo analytics calcolato */
export const REPORT_TYPE_TO_ANALYTICS: Record<string, AnalyticsType> = {
  ATTENDANCE: 'attendance',
  FINANCIAL: 'financial',
  OVERVIEW: 'overview',
  PROGRESS: 'trends',
  CLASS_ANALYTICS: 'overview',
  TEACHER_PERFORMANCE: 'overview',
};

export async function computeAnalytics(
  type: AnalyticsType,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, any>> {
  switch (type) {
    case 'attendance':
      return computeAttendanceStats(tenantId, startDate, endDate);
    case 'financial':
      return computeFinancialStats(tenantId, startDate, endDate);
    case 'trends':
      return computeTrendStats(tenantId, startDate, endDate);
    case 'overview':
    default:
      return computeOverviewStats(tenantId, startDate, endDate);
  }
}

export async function computeOverviewStats(tenantId: string, startDate: Date, endDate: Date) {
  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    totalLessons,
    activeStudents,
    overduePayments,
    totalRevenue,
    attendanceRate,
  ] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.teacher.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.class.count({ where: { tenantId, isActive: true } }),
    prisma.lesson.count({
      where: {
        tenantId,
        startTime: { gte: startDate, lte: endDate },
      },
    }),
    prisma.student.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        updatedAt: { gte: subDays(endDate, 30) },
      },
    }),
    prisma.payment.count({
      where: {
        tenantId,
        status: 'OVERDUE',
      },
    }),
    prisma.payment.aggregate({
      where: {
        tenantId,
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
    computeAttendanceRateForPeriod(tenantId, startDate, endDate),
  ]);

  const revenueAmount = totalRevenue._sum.amount || 0;
  return {
    totalStudents,
    totalTeachers,
    totalClasses,
    totalLessons,
    activeStudents,
    overduePayments,
    totalRevenue: Number(revenueAmount),
    attendanceRate: attendanceRate || 0,
    paymentRate:
      revenueAmount && totalStudents > 0
        ? (Number(revenueAmount) / (totalStudents * 100)) * 100
        : 0, // Simplified calculation
  };
}

export async function computeAttendanceStats(tenantId: string, startDate: Date, endDate: Date) {
  const attendance = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      lesson: {
        tenantId,
      },
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { status: true },
  });

  const dailyAttendance = await prisma.attendance.groupBy({
    by: ['createdAt'],
    where: {
      lesson: {
        tenantId,
      },
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  // Format daily data for charts
  const dailyData = dailyAttendance.reduce((acc, item) => {
    const date = format(item.createdAt, 'yyyy-MM-dd');
    acc[date] = (acc[date] || 0) + (item._count?.id || 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    byStatus: attendance,
    daily: dailyData,
    totalRecords: attendance.reduce((sum, item) => sum + (item._count?.status || 0), 0),
  };
}

export async function computeFinancialStats(tenantId: string, startDate: Date, endDate: Date) {
  const [payments, monthlyRevenue] = await Promise.all([
    prisma.payment.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { status: true },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
  ]);

  // Format monthly revenue for charts
  const revenueData = monthlyRevenue.reduce((acc, item) => {
    const date = format(item.createdAt, 'yyyy-MM-dd');
    acc[date] = (acc[date] || 0) + Number(item._sum.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    byStatus: payments,
    dailyRevenue: revenueData,
    totalRevenue: payments.reduce((sum, item) => sum + Number(item._sum.amount || 0), 0),
  };
}

export async function computeTrendStats(tenantId: string, startDate: Date, endDate: Date) {
  // Get enrollment trends
  const enrollments = await prisma.student.groupBy({
    by: ['createdAt'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  // Get lesson trends
  const lessons = await prisma.lesson.groupBy({
    by: ['startTime'],
    where: {
      tenantId,
      startTime: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
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

  return {
    enrollments: enrollmentTrends,
    lessons: lessonTrends,
  };
}

export async function computeAttendanceRateForPeriod(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const [present, total] = await Promise.all([
    prisma.attendance.count({
      where: {
        lesson: {
          tenantId,
        },
        status: 'PRESENT',
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.attendance.count({
      where: {
        lesson: {
          tenantId,
        },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  return total > 0 ? (present / total) * 100 : 0;
}
