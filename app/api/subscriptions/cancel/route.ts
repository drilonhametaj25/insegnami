import { NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cancelSubscription } from '@/lib/stripe';
import { isDevBilling } from '@/lib/billing/billing-mode';
import { devCancelSubscription } from '@/lib/billing/dev-billing';
import { invalidateTenantAccessCache } from '@/lib/tenant-access';

/**
 * POST /api/subscriptions/cancel
 *
 * Annullamento self-service dell'abbonamento del tenant, sempre a fine
 * periodo (cancelAtPeriodEnd: true): il servizio resta attivo fino alla
 * scadenza già pagata e non viene rinnovato. L'utente può riattivarlo
 * in qualsiasi momento prima della scadenza via /api/subscriptions/reactivate.
 *
 * - Dev billing: delega a devCancelSubscription (aggiorna DB + cache).
 * - Stripe: cancel_at_period_end su Stripe + riflesso immediato in DB per
 *   evitare flash UI (il webhook customer.subscription.updated resta la
 *   fonte canonica e riconcilierà lo stato).
 */
export async function POST() {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Solo i ruoli amministrativi possono gestire l'abbonamento
    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Nessun abbonamento da annullare.' },
        { status: 400 }
      );
    }

    if (subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "L'abbonamento è già in annullamento a fine periodo." },
        { status: 400 }
      );
    }

    if (subscription.status === 'CANCELLED') {
      return NextResponse.json(
        { error: "L'abbonamento è già stato annullato." },
        { status: 400 }
      );
    }

    // Dev billing mode: simulazione interna (aggiorna DB e invalida la cache)
    if (isDevBilling()) {
      const updated = await devCancelSubscription({ tenantId, cancelAtPeriodEnd: true });
      return NextResponse.json({
        success: true,
        subscription: {
          id: updated.id,
          status: updated.status,
          cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
          currentPeriodEnd: updated.currentPeriodEnd,
          cancelledAt: updated.cancelledAt,
        },
      });
    }

    // Stripe reale: annulla a fine periodo (mai immediato dal self-service)
    await cancelSubscription({
      subscriptionId: subscription.stripeSubscriptionId,
      cancelAtPeriodEnd: true,
    });

    const updated = await prisma.subscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: true },
      include: { plan: true },
    });

    await invalidateTenantAccessCache(tenantId);

    return NextResponse.json({
      success: true,
      subscription: {
        id: updated.id,
        status: updated.status,
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        currentPeriodEnd: updated.currentPeriodEnd,
        cancelledAt: updated.cancelledAt,
      },
    });
  } catch (error) {
    console.error('subscription cancel error:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json(
      { error: "Errore nell'annullamento dell'abbonamento", detail: message },
      { status: 500 }
    );
  }
}
