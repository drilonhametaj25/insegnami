import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createBillingPortalSession } from '@/lib/stripe';

// POST /api/subscriptions/portal - Create Stripe billing portal session
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admin can access billing portal
    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe non configurato' },
        { status: 500 }
      );
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Nessun account di fatturazione trovato. Sottoscrivi prima un abbonamento.' },
        { status: 400 }
      );
    }

    // Create billing portal session
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const portalSession = await createBillingPortalSession({
      customerId: tenant.stripeCustomerId,
      returnUrl: `${baseUrl}/it/dashboard/billing`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del portale di fatturazione' },
      { status: 500 }
    );
  }
}
