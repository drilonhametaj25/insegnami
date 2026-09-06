import { prisma } from '@/lib/db';
import type { AddonType, Plan } from '@prisma/client';
import { TRIAL_DAYS } from './billing-mode';
import { getAddonDefinition } from './addons';
import { invalidateTenantAccessCache } from '@/lib/tenant-access';
import { logger } from '@/lib/logger';

// Il dev-billing NON addebita nulla: ogni uso va reso rumoroso nei log,
// così un ambiente di produzione con chiavi placeholder non passa inosservato
// (env-validation lo blocca già, questo è il secondo livello di difesa).
let devBillingWarned = false;
function warnDevBilling(op: string): void {
  if (!devBillingWarned) {
    logger.warn(
      `DEV BILLING ATTIVO (${op}): nessun addebito reale verrà effettuato. ` +
        'Se questo è un ambiente di produzione, configurare le chiavi Stripe.'
    );
    devBillingWarned = true;
  }
}

/**
 * Implementazione interna del billing (dev billing mode) che simula
 * Stripe scrivendo direttamente sul database. Usata quando le chiavi
 * Stripe non sono configurate. Le firme rispecchiano il comportamento
 * atteso lato Stripe così le route possono usarla in modo trasparente.
 */

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Attiva (o crea) un abbonamento per il tenant sul piano indicato,
 * simulando il completamento del checkout Stripe.
 */
export async function devActivateSubscription({
  tenantId,
  plan,
  withTrial = true,
  yearly = false,
}: {
  tenantId: string;
  plan: Plan;
  withTrial?: boolean;
  /** Fatturazione annuale scelta al checkout (12 mesi al prezzo di 10). */
  yearly?: boolean;
}) {
  warnDevBilling('activate-subscription');
  const now = new Date();
  const isYearly = yearly || plan.interval === 'YEARLY';
  const periodEnd = addMonths(now, isYearly ? 12 : 1);
  const trialEnd = withTrial ? new Date(now.getTime() + TRIAL_DAYS * 86400000) : null;
  // Intervallo di fatturazione persistito come farebbe il webhook Stripe
  const interval = isYearly ? ('YEARLY' as const) : ('MONTHLY' as const);

  const subscription = await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planId: plan.id,
      stripeSubscriptionId: `dev_sub_${tenantId}`,
      stripeCustomerId: `dev_cus_${tenantId}`,
      status: withTrial ? 'TRIALING' : 'ACTIVE',
      interval,
      currentPeriodStart: now,
      currentPeriodEnd: withTrial ? trialEnd! : periodEnd,
      trialStart: withTrial ? now : null,
      trialEnd,
      cancelAtPeriodEnd: false,
    },
    update: {
      planId: plan.id,
      status: withTrial ? 'TRIALING' : 'ACTIVE',
      interval,
      currentPeriodStart: now,
      currentPeriodEnd: withTrial ? trialEnd! : periodEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
    include: { plan: true },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: plan.slug, isActive: true },
  });

  await invalidateTenantAccessCache(tenantId);
  return subscription;
}

/** Cambia piano (upgrade/downgrade) immediato, simulando la proration di Stripe. */
export async function devChangePlan({
  tenantId,
  plan,
  yearly,
}: {
  tenantId: string;
  plan: Plan;
  /** Se definito, aggiorna anche l'intervallo di fatturazione (MONTHLY/YEARLY). */
  yearly?: boolean;
}) {
  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!existing) {
    // Nessun abbonamento: equivale ad attivarne uno (senza nuovo trial).
    return devActivateSubscription({ tenantId, plan, withTrial: false, yearly });
  }

  const subscription = await prisma.subscription.update({
    where: { tenantId },
    data: {
      planId: plan.id,
      // l'upgrade/downgrade mantiene il periodo corrente; lo stato resta invariato
      // (TRIALING → resta in prova, ACTIVE → resta attivo). L'intervallo cambia
      // solo se richiesto esplicitamente dal chiamante.
      ...(yearly !== undefined ? { interval: yearly ? ('YEARLY' as const) : ('MONTHLY' as const) } : {}),
    },
    include: { plan: true },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: plan.slug },
  });

  await invalidateTenantAccessCache(tenantId);
  return subscription;
}

/** Annulla a fine periodo (o immediatamente). */
export async function devCancelSubscription({
  tenantId,
  cancelAtPeriodEnd = true,
}: {
  tenantId: string;
  cancelAtPeriodEnd?: boolean;
}) {
  const subscription = await prisma.subscription.update({
    where: { tenantId },
    data: cancelAtPeriodEnd
      ? { cancelAtPeriodEnd: true }
      : { status: 'CANCELLED', cancelledAt: new Date(), cancelAtPeriodEnd: true },
    include: { plan: true },
  });
  await invalidateTenantAccessCache(tenantId);
  return subscription;
}

/** Riattiva un abbonamento annullato ma non ancora scaduto. */
export async function devReactivateSubscription({ tenantId }: { tenantId: string }) {
  const subscription = await prisma.subscription.update({
    where: { tenantId },
    data: { cancelAtPeriodEnd: false, cancelledAt: null },
    include: { plan: true },
  });
  await invalidateTenantAccessCache(tenantId);
  return subscription;
}

/** Acquista (o incrementa) un add-on a pacchetti. */
export async function devPurchaseAddon({
  tenantId,
  type,
  quantity = 1,
}: {
  tenantId: string;
  type: AddonType;
  quantity?: number;
}) {
  warnDevBilling('purchase-addon');
  // Parità con Stripe (stripe-addons.ts): niente add-on senza abbonamento
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription || !['ACTIVE', 'TRIALING'].includes(subscription.status)) {
    throw new Error('Nessun abbonamento attivo: gli add-on richiedono un piano attivo');
  }

  const def = getAddonDefinition(type);
  const existing = await prisma.tenantAddon.findFirst({
    where: { tenantId, type, status: 'ACTIVE' },
  });

  if (existing) {
    return prisma.tenantAddon.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  }

  return prisma.tenantAddon.create({
    data: {
      tenantId,
      type,
      quantity,
      unitSize: def.unitSize,
      unitPrice: def.unitPrice,
      status: 'ACTIVE',
    },
  });
}

/** Riduce/rimuove un add-on. Se la quantità scende a 0 viene annullato. */
export async function devRemoveAddon({
  tenantId,
  type,
  quantity = 1,
}: {
  tenantId: string;
  type: AddonType;
  quantity?: number;
}) {
  const existing = await prisma.tenantAddon.findFirst({
    where: { tenantId, type, status: 'ACTIVE' },
  });
  if (!existing) return null;

  const newQty = existing.quantity - quantity;
  if (newQty <= 0) {
    return prisma.tenantAddon.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', quantity: 0 },
    });
  }
  return prisma.tenantAddon.update({
    where: { id: existing.id },
    data: { quantity: newQty },
  });
}
