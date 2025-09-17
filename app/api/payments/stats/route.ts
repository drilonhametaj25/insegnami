import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can access stats
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Update overdue payments
    await prisma.payment.updateMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: {
          lt: now,
        },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    // Get payment statistics
    const [
      totalRevenue,
      pendingPayments,
      overduePayments,
      thisMonthPaid,
      allPayments
    ] = await Promise.all([
      // Total revenue (all paid payments)
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
        },
        _sum: {
          amount: true,
        },
      }),

      // Pending payments
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'PENDING',
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),

      // Overdue payments
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'OVERDUE',
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),

      // This month paid
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
          paidDate: {
            gte: thisMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // All payments count
      prisma.payment.count({
        where: {
          tenantId,
        },
      }),
    ]);

    // Get monthly revenue for chart (last 12 months)
    const monthlyRevenue = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        return prisma.payment.aggregate({
          where: {
            tenantId,
            status: 'PAID',
            paidDate: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }).then(result => ({
          month: monthStart.toLocaleString('it-IT', { month: 'short', year: 'numeric' }),
          amount: Number(result._sum.amount || 0),
        }));
      })
    );

    // Get payment status distribution
    const statusDistribution = await prisma.payment.groupBy({
      by: ['status'],
      where: {
        tenantId,
      },
      _count: true,
      _sum: {
        amount: true,
      },
    });

    const stats = {
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      pendingAmount: Number(pendingPayments._sum.amount || 0),
      overdueAmount: Number(overduePayments._sum.amount || 0),
      paidThisMonth: Number(thisMonthPaid._sum.amount || 0),
      pendingCount: pendingPayments._count,
      overdueCount: overduePayments._count,
      totalCount: allPayments,
      monthlyRevenue: monthlyRevenue.reverse(),
      statusDistribution: statusDistribution.map(stat => ({
        status: stat.status,
        count: stat._count,
        amount: Number(stat._sum.amount || 0),
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
