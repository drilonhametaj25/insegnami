import { NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { reactivateSubscription } from '@/lib/stripe';
import { isDevBilling } from '@/lib/billing/billing-mode';
import { devReactivateSubscription } from '@/lib/billing/dev-billing';
import { invalidateTenantAccessCache } from '@/lib/tenant-access';

/**
 * POST /api/subscriptions/reactivate
 *
 * Riattiva un abbonamento in annullamento a fine periodo (speculare di
 * /api/subscriptions/cancel): rimuove cancel_at_period_end finché il
 * periodo corrente non è scaduto. Non riattiva abbonamenti già terminati
 * (status CANCELLED): in quel caso serve un nuovo checkout.
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
        { error: 'Nessun abbonamento da riattivare.' },
        { status: 400 }
      );
    }

    if (subscription.status === 'CANCELLED') {
      return NextResponse.json(
        { error: "L'abbonamento è già terminato: sottoscrivi un nuovo piano." },
        { status: 400 }
      );
    }

    if (!subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "L'abbonamento non è in annullamento: nulla da riattivare." },
        { status: 400 }
      );
    }

    // Dev billing mode: simulazione interna (aggiorna DB e invalida la cache)
    if (isDevBilling()) {
      const updated = await devReactivateSubscription({ tenantId });
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

    // Stripe reale: rimuove cancel_at_period_end
    await reactivateSubscription(subscription.stripeSubscriptionId);

    const updated = await prisma.subscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: false, cancelledAt: null },
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
    console.error('subscription reactivate error:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json(
      { error: "Errore nella riattivazione dell'abbonamento", detail: message },
      { status: 500 }
    );
  }
}
