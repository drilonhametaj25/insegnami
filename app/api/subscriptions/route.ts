import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/subscriptions - Get current tenant subscription
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admin can view subscription
    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: session.user.tenantId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      // No subscription, return tenant info for trial status
      const tenant = await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: {
          id: true,
          name: true,
          plan: true,
          trialUntil: true,
          isActive: true,
          stripeCustomerId: true,
        },
      });

      return NextResponse.json({
        subscription: null,
        tenant,
        status: tenant?.trialUntil && new Date(tenant.trialUntil) > new Date()
          ? 'trialing'
          : 'no_subscription',
      });
    }

    return NextResponse.json({
      subscription,
      status: subscription.status.toLowerCase(),
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero abbonamento' },
      { status: 500 }
    );
  }
}
