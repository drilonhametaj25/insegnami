import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError } from '@/lib/api-auth';
import { endOfDay } from '@/lib/dates';

export async function GET(request: NextRequest) {
  try {
    // Roles espliciti: payment:read in matrice include STUDENT/PARENT, ma le stats sono dati di scuola
    const ctx = await requireAuth({ roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'] });

    const tenantId = ctx.tenantId;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // NB: la transizione PENDING→OVERDUE è responsabilità del cron
    // markPaymentsOverdue (lib/workers/cron-scheduler): una GET di sole
    // statistiche non deve avere side-effect di scrittura.

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
        // endOfDay: l'ultimo giorno del mese va incluso per intero
        const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() - i + 1, 0));

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
    const r = authError(error);
    if (r) return r;
    console.error('Error fetching payment stats:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
