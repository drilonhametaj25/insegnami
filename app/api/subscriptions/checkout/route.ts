import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  getOrCreateCustomer,
  createSubscriptionCheckoutSession,
} from '@/lib/stripe';
import { isDevBilling } from '@/lib/billing/billing-mode';
import { devActivateSubscription } from '@/lib/billing/dev-billing';

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

    const body = await request.json();
    const { planId, interval } = checkoutSchema.parse(body);

    // Get the plan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Piano non trovato o non attivo' },
        { status: 404 }
      );
    }

    // Annuale: prezzo dedicato sullo stesso piano (12 mesi al prezzo di 10),
    // creato dalla sync in Plan.stripeYearlyPriceId. Se non è ancora stato
    // sincronizzato si procede col mensile invece di bloccare il checkout.
    const useYearly = interval === 'yearly' && !!plan.stripeYearlyPriceId;

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

    // Blocca anche TRIALING: chi è già in prova non deve poter aprire un nuovo
    // checkout (otterrebbe un nuovo trial, abuso del periodo di prova).
    if (
      existingSubscription &&
      ['ACTIVE', 'TRIALING'].includes(existingSubscription.status)
    ) {
      return NextResponse.json(
        { error: 'Hai già un abbonamento attivo o in prova. Usa il portale di fatturazione per cambiare piano.' },
        { status: 400 }
      );
    }

    // Guard anti-abuso trial: i giorni di prova derivano dal residuo di
    // tenant.trialUntil (fissato alla registrazione), NON da un valore fisso.
    // Chi annulla e rifà il checkout non ottiene un nuovo trial pieno.
    const trialDays = tenant.trialUntil
      ? Math.max(0, Math.ceil((new Date(tenant.trialUntil).getTime() - Date.now()) / 86400000))
      : 0;

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';

    // Dev billing mode: niente Stripe esterno. Attiviamo direttamente
    // l'abbonamento (con trial solo se residuo) e rimandiamo alla pagina di fatturazione.
    if (isDevBilling()) {
      await devActivateSubscription({
        tenantId: tenant.id,
        plan,
        withTrial: trialDays > 0,
        yearly: interval === 'yearly',
      });
      return NextResponse.json({
        url: `${baseUrl}/it/dashboard/billing?success=true`,
        dev: true,
      });
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
    const checkoutSession = await createSubscriptionCheckoutSession({
      customerId: customer.id,
      priceId: useYearly ? plan.stripeYearlyPriceId! : plan.stripePriceId,
      tenantId: tenant.id,
      successUrl: `${baseUrl}/it/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/it/dashboard/billing?cancelled=true`,
      trialDays, // residuo del trial del tenant (0 se scaduto o assente)
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
