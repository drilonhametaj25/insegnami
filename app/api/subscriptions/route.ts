import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getEffectiveFeatures } from '@/lib/billing/features';

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

    // Feature effettive del tenant (piano + override): usate dalla UI per il
    // gating (Sidebar/upsell). Fail-open: su errore infra → mappa vuota.
    const features = await getEffectiveFeatures(session.user.tenantId).catch(() => ({}));

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
        features,
      });
    }

    return NextResponse.json({
      subscription,
      status: subscription.status.toLowerCase(),
      // Campi convenience per la UI (dunning banner, prezzo per intervallo)
      interval: subscription.interval,
      gracePeriodEnd: subscription.gracePeriodEnd,
      features,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero abbonamento' },
      { status: 500 }
    );
  }
}
