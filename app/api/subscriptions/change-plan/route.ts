import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateSubscriptionPlan, retrieveSubscription } from '@/lib/stripe';
import { isDevBilling } from '@/lib/billing/billing-mode';
import { devChangePlan } from '@/lib/billing/dev-billing';
import { validatePlanChange, getActiveUsage } from '@/lib/billing/plan-change';

const ChangePlanSchema = z.object({
  targetPlanSlug: z.string().min(1),
});

/**
 * POST /api/subscriptions/change-plan
 * Body: { targetPlanSlug: string }
 *
 * Switches the tenant's active subscription to a different plan.
 * - Upgrade: Stripe applies prorated charge immediately.
 * - Downgrade: same proration model — Stripe credits the difference, applied
 *   to the next invoice. The new price kicks in immediately.
 *
 * Webhook (`customer.subscription.updated`) reconciles our DB. We do NOT update
 * Subscription rows here, to keep Stripe as the source of truth for billing
 * status (and avoid race conditions with the webhook).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ChangePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetPlanSlug } = parsed.data;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: session.user.tenantId },
      include: { plan: true },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Nessun abbonamento attivo. Sottoscrivi prima un piano.' },
        { status: 400 }
      );
    }

    if (subscription.plan?.slug === targetPlanSlug) {
      return NextResponse.json(
        { error: 'Sei già su questo piano' },
        { status: 400 }
      );
    }

    const targetPlan = await prisma.plan.findUnique({
      where: { slug: targetPlanSlug },
    });

    if (!targetPlan || !targetPlan.isActive) {
      return NextResponse.json(
        { error: 'Piano non trovato o non disponibile' },
        { status: 404 }
      );
    }

    // Downgrade consentito solo se le risorse attive (studenti/docenti/classi)
    // rientrano nei limiti del piano target + add-on. Vale per entrambe le
    // modalità billing: senza questo check i limiti diventano inapplicabili.
    const validation = await validatePlanChange(session.user.tenantId, targetPlan);
    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.message, code: 'LIMITS_EXCEEDED', violations: validation.violations },
        { status: 409 }
      );
    }

    // Dev billing mode: cambio piano immediato sul DB, senza Stripe.
    if (isDevBilling()) {
      const updated = await devChangePlan({ tenantId: session.user.tenantId, plan: targetPlan });
      return NextResponse.json({
        success: true,
        subscriptionId: updated.id,
        currentPeriodEnd: updated.currentPeriodEnd,
        newPlan: {
          id: targetPlan.id,
          slug: targetPlan.slug,
          name: targetPlan.name,
          price: targetPlan.price,
          interval: targetPlan.interval,
        },
      });
    }

    if (!targetPlan.stripePriceId) {
      return NextResponse.json(
        { error: 'Piano non configurato in Stripe. Contatta il supporto.' },
        { status: 500 }
      );
    }

    const updatedSub = await updateSubscriptionPlan({
      subscriptionId: subscription.stripeSubscriptionId,
      newPriceId: targetPlan.stripePriceId,
    });

    // Read back authoritative state to surface to UI immediately. The webhook
    // will still write the canonical record into our DB, but returning the
    // freshest view here avoids a UI flash where the user sees the old plan.
    // current_period_end moved to subscription items in Stripe API 2024-06+,
    // so read from the first item.
    const fresh = (await retrieveSubscription(subscription.stripeSubscriptionId)) as any;
    const currentPeriodEnd =
      fresh.items?.data?.[0]?.current_period_end ?? fresh.current_period_end ?? null;

    return NextResponse.json({
      success: true,
      subscriptionId: updatedSub.id,
      currentPeriodEnd,
      newPlan: {
        id: targetPlan.id,
        slug: targetPlan.slug,
        name: targetPlan.name,
        price: targetPlan.price,
        interval: targetPlan.interval,
      },
    });
  } catch (error) {
    console.error('change-plan error:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json(
      { error: 'Errore nel cambio piano', detail: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscriptions/change-plan
 * Restituisce l'uso attivo del tenant e, per ogni piano attivo, se il
 * passaggio è consentito (con motivo in caso contrario). Usato dalla UI
 * billing per disabilitare i downgrade non permessi.
 */
export async function GET() {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const [usage, plans] = await Promise.all([
      getActiveUsage(tenantId),
      prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);

    const eligibility = await Promise.all(
      plans.map(async (plan) => {
        const validation = await validatePlanChange(tenantId, plan);
        return {
          planSlug: plan.slug,
          allowed: validation.allowed,
          message: validation.message,
          violations: validation.violations,
        };
      })
    );

    return NextResponse.json({ usage, eligibility });
  } catch (error) {
    console.error('change-plan eligibility error:', error);
    return NextResponse.json({ error: 'Errore nel calcolo eligibilità piani' }, { status: 500 });
  }
}
