import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createBillingPortalSession } from '@/lib/stripe';
import { isDevBilling } from '@/lib/billing/billing-mode';

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

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';

    // Dev billing mode: nessun portale Stripe. La gestione (cambio piano,
    // add-on, annullamento) avviene nella pagina di fatturazione interna.
    if (isDevBilling()) {
      return NextResponse.json({
        url: `${baseUrl}/it/dashboard/billing?manage=true`,
        dev: true,
      });
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
