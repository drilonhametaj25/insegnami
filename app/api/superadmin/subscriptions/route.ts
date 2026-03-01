import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/superadmin/subscriptions - List all subscriptions
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // ACTIVE, TRIALING, PAST_DUE, CANCELLED, etc.
    const planId = searchParams.get('planId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (planId) {
      where.planId = planId;
    }

    // Get subscriptions with related data
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              interval: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    // Format response
    const formattedSubscriptions = subscriptions.map((sub) => ({
      id: sub.id,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelledAt: sub.cancelledAt,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      tenant: sub.tenant,
      plan: sub.plan
        ? {
            ...sub.plan,
            price: parseFloat(sub.plan.price.toString()),
          }
        : null,
    }));

    // Get summary stats
    const statusCounts = await prisma.subscription.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const summary = {
      total,
      byStatus: statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('SuperAdmin subscriptions GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
