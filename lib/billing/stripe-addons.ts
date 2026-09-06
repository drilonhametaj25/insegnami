import type { AddonType, TenantAddon } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  createSubscriptionItem,
  updateSubscriptionItemQuantity,
  deleteSubscriptionItem,
  stripe,
} from '@/lib/stripe';
import { getAddonDefinition } from './addons';
import { getAddonPriceMap } from './stripe-sync';

/**
 * Acquisto/rimozione add-on in modalità Stripe reale: gli add-on diventano
 * subscription item aggiuntivi sull'abbonamento del tenant, con proration.
 * Lo stato canonico resta su Stripe; TenantAddon viene riconciliato sia qui
 * (per reattività della UI) sia dal webhook customer.subscription.updated.
 */

export class AddonBillingError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = 'AddonBillingError';
  }
}

function isMissingResourceError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'resource_missing';
}

// Stripe rifiuta subscription item con intervallo diverso da quello degli
// altri item ("...interval must match..."): errore da tipizzare, non un 500.
function isIntervalMismatchError(err: unknown): boolean {
  const e = err as { type?: string; message?: string };
  return (
    (e?.type === 'StripeInvalidRequestError' || e?.type === 'invalid_request_error') &&
    typeof e?.message === 'string' &&
    /interval/i.test(e.message)
  );
}

const INTERVAL_MISMATCH_MESSAGE =
  "L'intervallo di fatturazione dell'add-on non corrisponde a quello dell'abbonamento " +
  '(mensile vs annuale). Riprova più tardi o contatta il supporto: il prezzo ' +
  "dell'add-on per il tuo intervallo non è ancora sincronizzato.";

/** Abbonamento Stripe reale e fatturabile del tenant, o errore esplicativo. */
async function requireBillableSubscription(tenantId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });

  if (
    !subscription ||
    !subscription.stripeSubscriptionId ||
    subscription.stripeSubscriptionId.startsWith('dev_')
  ) {
    throw new AddonBillingError(
      'Per acquistare add-on è necessario un abbonamento attivo. Sottoscrivi prima un piano.',
      400
    );
  }
  if (!['ACTIVE', 'TRIALING'].includes(subscription.status)) {
    throw new AddonBillingError(
      'Il tuo abbonamento non è attivo: regolarizza il pagamento prima di acquistare add-on.',
      400
    );
  }
  return subscription;
}

/**
 * Prezzo Stripe dell'add-on coerente con l'intervallo dell'abbonamento:
 * subscription annuale → prezzo annuale (Stripe rifiuta interval misti).
 */
async function requireAddonPrice(type: AddonType, interval: 'MONTHLY' | 'YEARLY'): Promise<string> {
  const catalog = await prisma.addonCatalog.findUnique({ where: { type } });
  if (!catalog?.stripePriceId) {
    throw new AddonBillingError(
      'Add-on non ancora configurato per il pagamento. Contatta il supporto.',
      503
    );
  }
  if (interval === 'YEARLY') {
    if (!catalog.stripeYearlyPriceId) {
      // Senza prezzo annuale l'item verrebbe rifiutato da Stripe con un
      // interval mismatch: meglio un errore chiaro prima della chiamata.
      throw new AddonBillingError(INTERVAL_MISMATCH_MESSAGE, 409);
    }
    return catalog.stripeYearlyPriceId;
  }
  return catalog.stripePriceId;
}

/** Acquista (o incrementa) un add-on come subscription item Stripe. */
export async function stripePurchaseAddon({
  tenantId,
  type,
  quantity = 1,
}: {
  tenantId: string;
  type: AddonType;
  quantity?: number;
}): Promise<TenantAddon> {
  const def = getAddonDefinition(type);
  const subscription = await requireBillableSubscription(tenantId);
  // Prezzo coerente con l'intervallo di fatturazione dell'abbonamento
  const priceId = await requireAddonPrice(type, subscription.interval);

  const existing = await prisma.tenantAddon.findFirst({
    where: { tenantId, type, status: 'ACTIVE' },
  });

  // Stripe prima, DB dopo: se il write DB fallisce, il webhook riconcilia.
  if (existing?.stripeSubscriptionItemId) {
    const newQty = existing.quantity + quantity;
    await updateSubscriptionItemQuantity({
      itemId: existing.stripeSubscriptionItemId,
      quantity: newQty,
    });
    return prisma.tenantAddon.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  }

  const totalQty = (existing?.quantity ?? 0) + quantity;
  let item;
  try {
    item = await createSubscriptionItem({
      subscriptionId: subscription.stripeSubscriptionId,
      priceId,
      quantity: totalQty,
      metadata: { tenantId, addonType: type },
    });
  } catch (err) {
    // Tipizza l'interval mismatch di Stripe (subscription cambiata fuori
    // banda tra la lettura e la create): messaggio chiaro invece di 500.
    if (isIntervalMismatchError(err)) {
      throw new AddonBillingError(INTERVAL_MISMATCH_MESSAGE, 409);
    }
    throw err;
  }

  if (existing) {
    // Riga acquistata in dev billing prima dello switch a Stripe: aggancia l'item
    return prisma.tenantAddon.update({
      where: { id: existing.id },
      data: { quantity: totalQty, stripeSubscriptionItemId: item.id },
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
      stripeSubscriptionItemId: item.id,
    },
  });
}

/** Riduce/rimuove un add-on; a quantità 0 l'item Stripe viene eliminato (credito prorata). */
export async function stripeRemoveAddon({
  tenantId,
  type,
  quantity = 1,
}: {
  tenantId: string;
  type: AddonType;
  quantity?: number;
}): Promise<TenantAddon | null> {
  const existing = await prisma.tenantAddon.findFirst({
    where: { tenantId, type, status: 'ACTIVE' },
  });
  if (!existing) return null;

  const newQty = existing.quantity - quantity;
  const itemId = existing.stripeSubscriptionItemId;

  if (itemId) {
    try {
      if (newQty <= 0) {
        // Stripe non accetta quantity 0: la rimozione completa elimina l'item
        await deleteSubscriptionItem(itemId);
      } else {
        await updateSubscriptionItemQuantity({ itemId, quantity: newQty });
      }
    } catch (err) {
      // Item già eliminato fuori banda (es. billing portal): allinea solo il DB
      if (!isMissingResourceError(err)) throw err;
    }
  }

  if (newQty <= 0) {
    return prisma.tenantAddon.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', quantity: 0, stripeSubscriptionItemId: null },
    });
  }
  return prisma.tenantAddon.update({
    where: { id: existing.id },
    data: { quantity: newQty },
  });
}

/**
 * Riconcilia TenantAddon con gli item dell'abbonamento Stripe (dal webhook).
 * - Item add-on presenti su Stripe → riga ACTIVE con quantità allineata.
 * - Righe con stripeSubscriptionItemId non più presente → CANCELLED.
 * - Le righe SENZA stripeSubscriptionItemId non vengono MAI toccate:
 *   sono acquisti dev-billing e non appartengono a Stripe.
 */
export async function reconcileAddonItems({
  tenantId,
  stripeSubscriptionId,
  items,
}: {
  tenantId: string;
  stripeSubscriptionId: string;
  items: Array<{
    id: string;
    quantity?: number;
    price?: { id?: string; metadata?: Record<string, string> };
  }>;
  // payload del webhook; ha has_more implicito gestito sotto
}): Promise<void> {
  // Difensivo: con più di 10 item Stripe pagina la lista (noi ne abbiamo max 5)
  let fullItems = items;
  if (items.length >= 10) {
    const listed = await stripe.subscriptionItems.list({
      subscription: stripeSubscriptionId,
      limit: 100,
    });
    fullItems = listed.data as typeof items;
  }

  const priceMap = await getAddonPriceMap(prisma as any);

  const resolveType = (item: (typeof fullItems)[number]): AddonType | null => {
    const metaType = item.price?.metadata?.addonType as AddonType | undefined;
    if (metaType) return metaType;
    if (item.price?.id && priceMap.has(item.price.id)) return priceMap.get(item.price.id)!;
    return null;
  };

  const addonItems = fullItems
    .map((item) => ({ item, type: resolveType(item) }))
    .filter((x): x is { item: (typeof fullItems)[number]; type: AddonType } => x.type !== null);

  const seenItemIds = new Set<string>();

  for (const { item, type } of addonItems) {
    seenItemIds.add(item.id);
    const quantity = item.quantity ?? 1;
    const def = getAddonDefinition(type);

    const byItemId = await prisma.tenantAddon.findFirst({
      where: { tenantId, stripeSubscriptionItemId: item.id },
    });
    if (byItemId) {
      if (byItemId.quantity !== quantity || byItemId.status !== 'ACTIVE') {
        await prisma.tenantAddon.update({
          where: { id: byItemId.id },
          data: { quantity, status: 'ACTIVE' },
        });
      }
      continue;
    }

    // Aggancia una riga attiva dello stesso tipo non ancora collegata a Stripe
    const orphan = await prisma.tenantAddon.findFirst({
      where: { tenantId, type, status: 'ACTIVE', stripeSubscriptionItemId: null },
    });
    if (orphan) {
      await prisma.tenantAddon.update({
        where: { id: orphan.id },
        data: { quantity, stripeSubscriptionItemId: item.id },
      });
      continue;
    }

    await prisma.tenantAddon.create({
      data: {
        tenantId,
        type,
        quantity,
        unitSize: def.unitSize,
        unitPrice: def.unitPrice,
        status: 'ACTIVE',
        stripeSubscriptionItemId: item.id,
      },
    });
  }

  // Righe collegate a item che non esistono più su Stripe → cancellate
  const stale = await prisma.tenantAddon.findMany({
    where: { tenantId, status: 'ACTIVE', stripeSubscriptionItemId: { not: null } },
  });
  for (const row of stale) {
    if (!seenItemIds.has(row.stripeSubscriptionItemId as string)) {
      await prisma.tenantAddon.update({
        where: { id: row.id },
        data: { status: 'CANCELLED', quantity: 0, stripeSubscriptionItemId: null },
      });
    }
  }
}
