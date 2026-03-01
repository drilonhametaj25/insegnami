import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  getOrCreateCustomer,
  createSubscriptionCheckoutSession,
} from '@/lib/stripe';

const checkoutSchema = z.object({
  planId: z.string().min(1, 'Piano richiesto'),
  interval: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

// POST /api/subscriptions/checkout - Create Stripe checkout session for subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admin can manage subscriptions
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

    const body = await request.json();
    const { planId, interval } = checkoutSchema.parse(body);

    // Get the plan
    let plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Piano non trovato o non attivo' },
        { status: 404 }
      );
    }

    // If yearly interval requested, try to find the yearly version of this plan
    if (interval === 'yearly' && plan.interval === 'MONTHLY') {
      const yearlyPlan = await prisma.plan.findFirst({
        where: {
          slug: plan.slug,
          interval: 'YEARLY',
          isActive: true,
        },
      });

      // Use yearly plan if available, otherwise continue with monthly
      if (yearlyPlan) {
        plan = yearlyPlan;
      }
    }

    // Get tenant and user info
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant non trovato' },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Check if already has active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { tenantId: tenant.id },
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Hai già un abbonamento attivo. Usa il portale di fatturazione per cambiare piano.' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      tenantId: tenant.id,
      existingCustomerId: tenant.stripeCustomerId,
    });

    // Update tenant with Stripe customer ID if new
    if (!tenant.stripeCustomerId) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Create checkout session
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const checkoutSession = await createSubscriptionCheckoutSession({
      customerId: customer.id,
      priceId: plan.stripePriceId,
      tenantId: tenant.id,
      successUrl: `${baseUrl}/it/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/it/dashboard/billing?cancelled=true`,
      trialDays: 14, // 14-day trial
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Errore nella creazione del checkout' },
      { status: 500 }
    );
  }
}
