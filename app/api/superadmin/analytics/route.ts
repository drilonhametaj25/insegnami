import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/superadmin/analytics - Global platform analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days

    const periodDays = parseInt(period);
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Get all stats in parallel
    const [
      // Tenant stats
      totalTenants,
      activeTenants,
      newTenantsInPeriod,

      // Subscription stats
      totalSubscriptions,
      activeSubscriptions,
      trialingSubscriptions,
      cancelledInPeriod,

      // User stats
      totalUsers,
      activeUsers,
      newUsersInPeriod,

      // Revenue stats - from plans
      revenueByPlan,

      // Usage stats
      totalStudents,
      totalTeachers,
      totalClasses,
      totalLessons,
      totalPayments,

      // Recent activity
      recentTenants,
      recentSubscriptions,
    ] = await Promise.all([
      // Tenant counts
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.tenant.count({ where: { createdAt: { gte: periodStart } } }),

      // Subscription counts
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIALING' } }),
      prisma.subscription.count({
        where: {
          status: 'CANCELLED',
          cancelledAt: { gte: periodStart },
        },
      }),

      // User counts
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: periodStart } } }),

      // Revenue by plan
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              interval: true,
            },
          },
        },
      }),

      // Usage counts
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.lesson.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),

      // Recent activity
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      }),
      prisma.subscription.findMany({
        where: { createdAt: { gte: periodStart } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          tenant: { select: { name: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);

    // Calculate MRR from active subscriptions
    let mrr = 0;
    const revenueBreakdown: Record<string, { count: number; mrr: number }> = {};

    revenueByPlan.forEach((sub) => {
      if (sub.plan) {
        const monthlyPrice =
          sub.plan.interval === 'YEARLY'
            ? parseFloat(sub.plan.price.toString()) / 12
            : parseFloat(sub.plan.price.toString());

        mrr += monthlyPrice;

        if (!revenueBreakdown[sub.plan.name]) {
          revenueBreakdown[sub.plan.name] = { count: 0, mrr: 0 };
        }
        revenueBreakdown[sub.plan.name].count++;
        revenueBreakdown[sub.plan.name].mrr += monthlyPrice;
      }
    });

    // Calculate churn rate
    const churnRate =
      activeSubscriptions > 0 ? (cancelledInPeriod / activeSubscriptions) * 100 : 0;

    // Calculate growth rate
    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);

    const tenantsInPreviousPeriod = await prisma.tenant.count({
      where: {
        createdAt: {
          gte: previousPeriodStart,
          lt: periodStart,
        },
      },
    });

    const tenantGrowthRate =
      tenantsInPreviousPeriod > 0
        ? ((newTenantsInPeriod - tenantsInPreviousPeriod) / tenantsInPreviousPeriod) * 100
        : newTenantsInPeriod > 0
          ? 100
          : 0;

    return NextResponse.json({
      period: {
        days: periodDays,
        start: periodStart.toISOString(),
        end: new Date().toISOString(),
      },

      tenants: {
        total: totalTenants,
        active: activeTenants,
        inactive: totalTenants - activeTenants,
        newInPeriod: newTenantsInPeriod,
        growthRate: Math.round(tenantGrowthRate * 100) / 100,
      },

      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        trialing: trialingSubscriptions,
        cancelledInPeriod,
        churnRate: Math.round(churnRate * 100) / 100,
      },

      users: {
        total: totalUsers,
        active: activeUsers,
        newInPeriod: newUsersInPeriod,
      },

      revenue: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        byPlan: Object.entries(revenueBreakdown).map(([name, data]) => ({
          planName: name,
          subscriptions: data.count,
          mrr: Math.round(data.mrr * 100) / 100,
        })),
      },

      usage: {
        students: totalStudents,
        teachers: totalTeachers,
        classes: totalClasses,
        lessons: totalLessons,
        payments: totalPayments,
      },

      recentActivity: {
        tenants: recentTenants,
        subscriptions: recentSubscriptions.map((sub) => ({
          id: sub.id,
          tenantName: sub.tenant.name,
          planName: sub.plan?.name,
          status: sub.status,
          createdAt: sub.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('SuperAdmin analytics GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
