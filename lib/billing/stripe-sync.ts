import type { AddonType, PrismaClient } from '@prisma/client';
import { stripe, createNewPrice, deactivatePrice, PLATFORM_METADATA } from '@/lib/stripe';
import { ADDON_CATALOG } from './addons';
import { PLAN_CATALOG, yearlyPriceOf } from './plans-catalog';
import { isStripeEnabled } from './billing-mode';

/**
 * Sync idempotente del catalogo commerciale (3 piani + 4 add-on) su Stripe.
 *
 * - Crea il prodotto Stripe se manca (recovery via products.search sui
 *   metadata, così un DB perso non duplica i prodotti).
 * - Crea/ruota i prezzi se mancano o se l'importo nel catalogo è cambiato
 *   (il vecchio prezzo viene archiviato: gli abbonamenti esistenti
 *   continuano a fatturare sul prezzo vecchio).
 * - Ogni piano ha DUE prezzi sullo stesso prodotto: mensile e annuale
 *   (12 mesi al prezzo di 10, vedi yearlyPriceOf); gli add-on solo mensile.
 * - Persiste gli ID: Plan.stripePriceId/stripeYearlyPriceId per i piani,
 *   AddonCatalog per gli add-on.
 *
 * Tutte le entità create portano metadata { platform: 'InsegnaMi' }.
 */

export type SyncAction = 'created' | 'price_rotated' | 'unchanged' | 'relinked';

export interface SyncResult {
  kind: 'plan' | 'addon';
  key: string; // slug piano o AddonType
  productId: string;
  priceId: string;
  yearlyPriceId?: string; // solo per i piani
  action: SyncAction;
}

interface PriceSpec {
  amountCents: number;
  interval: 'month' | 'year';
}

function isMissingResourceError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'resource_missing';
}

/** Recupera un prodotto per ID, oppure cercalo per metadata; null se non esiste. */
async function findProduct(
  productId: string | null | undefined,
  metadataKey: string,
  metadataValue: string
) {
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId);
      if (!product.deleted) return product;
    } catch (err) {
      if (!isMissingResourceError(err)) throw err;
    }
  }
  // Recovery: il DB non ha l'ID (o è stale) ma il prodotto può già esistere su Stripe
  const found = await stripe.products.search({
    query: `metadata['${metadataKey}']:'${metadataValue}' AND metadata['platform']:'${PLATFORM_METADATA.platform}'`,
    limit: 1,
  });
  return found.data[0] ?? null;
}

/**
 * Il prezzo è ancora valido per la spec corrente del catalogo?
 * Oltre a importo/valuta/intervallo verifica che il prezzo appartenga al
 * prodotto risolto: un priceId stale che punta al prezzo di un prodotto
 * legacy (stesso importo, prodotto diverso) lascerebbe il prodotto nuovo
 * senza prezzo e il checkout aggancierebbe il prodotto sbagliato.
 */
async function isPriceValid(
  priceId: string | null | undefined,
  spec: PriceSpec,
  productId: string
): Promise<boolean> {
  if (!priceId) return false;
  try {
    const price = await stripe.prices.retrieve(priceId);
    const priceProductId = typeof price.product === 'string' ? price.product : price.product.id;
    return (
      price.active &&
      priceProductId === productId &&
      price.currency === 'eur' &&
      price.recurring?.interval === spec.interval &&
      price.unit_amount === spec.amountCents
    );
  } catch (err) {
    if (isMissingResourceError(err)) return false;
    throw err;
  }
}

/** Risolve (o crea) il prodotto Stripe per la entry di catalogo. */
async function ensureProduct({
  existingProductId,
  name,
  description,
  metadata,
  searchKey,
  searchValue,
}: {
  existingProductId: string | null | undefined;
  name: string;
  description: string;
  metadata: Record<string, string>;
  searchKey: string;
  searchValue: string;
}): Promise<{ product: { id: string }; created: boolean }> {
  let product = await findProduct(existingProductId, searchKey, searchValue);

  if (!product) {
    product = await stripe.products.create({
      name,
      description,
      metadata: { ...PLATFORM_METADATA, ...metadata },
    });
    return { product, created: true };
  }

  if (product.name !== name || product.description !== description) {
    await stripe.products.update(product.id, { name, description });
  }
  return { product, created: false };
}

/**
 * Garantisce che sul prodotto esista un prezzo conforme alla spec:
 * riusa existingPriceId se ancora valido, altrimenti ne crea uno nuovo
 * e archivia il vecchio (gli abbonamenti attivi non vengono toccati).
 */
async function ensurePrice({
  productId,
  existingPriceId,
  spec,
  metadata,
}: {
  productId: string;
  existingPriceId: string | null | undefined;
  spec: PriceSpec;
  metadata: Record<string, string>;
}): Promise<{ priceId: string; rotated: boolean }> {
  if (await isPriceValid(existingPriceId, spec, productId)) {
    return { priceId: existingPriceId!, rotated: false };
  }

  const price = await createNewPrice({
    productId,
    priceAmount: spec.amountCents,
    interval: spec.interval,
    metadata,
  });

  if (existingPriceId && existingPriceId !== price.id) {
    try {
      await deactivatePrice(existingPriceId);
    } catch (err) {
      if (!isMissingResourceError(err)) throw err;
    }
  }

  return { priceId: price.id, rotated: true };
}

async function ensureProductAndPrice({
  existingProductId,
  existingPriceId,
  name,
  description,
  spec,
  metadata,
  searchKey,
  searchValue,
}: {
  existingProductId: string | null | undefined;
  existingPriceId: string | null | undefined;
  name: string;
  description: string;
  spec: PriceSpec;
  metadata: Record<string, string>;
  searchKey: string;
  searchValue: string;
}): Promise<{ productId: string; priceId: string; action: SyncAction }> {
  const { product, created } = await ensureProduct({
    existingProductId,
    name,
    description,
    metadata,
    searchKey,
    searchValue,
  });

  const { priceId, rotated } = await ensurePrice({
    productId: product.id,
    existingPriceId,
    spec,
    metadata,
  });

  if (!rotated) {
    // 'relinked' solo se il chiamante PERSISTEVA un productId diverso da
    // quello trovato: i piani non persistono il productId (sempre null),
    // quindi senza il check su existingProductId ogni run risulterebbe
    // erroneamente 'relinked' invece di 'unchanged'.
    const relinked = !created && !!existingProductId && product.id !== existingProductId;
    return { productId: product.id, priceId, action: relinked ? 'relinked' : 'unchanged' };
  }

  return { productId: product.id, priceId, action: created ? 'created' : 'price_rotated' };
}

/**
 * Garantisce che i 3 piani del catalogo esistano nel DB.
 * Non tocca stripePriceId delle righe esistenti (lo gestisce la sync).
 */
export async function ensurePlansInDb(prisma: PrismaClient): Promise<void> {
  for (const plan of PLAN_CATALOG) {
    const existing = await prisma.plan.findUnique({ where: { slug: plan.slug } });
    if (existing) {
      await prisma.plan.update({
        where: { slug: plan.slug },
        data: {
          name: plan.name,
          price: plan.price,
          interval: plan.interval,
          maxStudents: plan.maxStudents,
          maxTeachers: plan.maxTeachers,
          maxClasses: plan.maxClasses,
          features: plan.features,
          description: plan.description,
          isPopular: plan.isPopular,
          sortOrder: plan.sortOrder,
          isActive: true,
        },
      });
    } else {
      await prisma.plan.create({
        data: {
          ...plan,
          // placeholder finché la sync non crea il prezzo reale
          stripePriceId: `price_${plan.slug}_dev`,
          isActive: true,
        },
      });
    }
  }
}

/** Sincronizza i piani su Stripe (prezzo mensile + annuale) e aggiorna il DB. */
export async function syncPlansToStripe(prisma: PrismaClient): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const def of PLAN_CATALOG) {
    const plan = await prisma.plan.findUnique({ where: { slug: def.slug } });
    if (!plan) continue;

    // I placeholder dev (price_starter_dev, ...) non sono ID Stripe reali
    const currentPriceId = plan.stripePriceId?.endsWith('_dev') ? null : plan.stripePriceId;
    const metadata = { planSlug: def.slug };

    const { product, created } = await ensureProduct({
      existingProductId: null, // i piani non persistono il productId: recovery via search
      name: `InsegnaMi ${def.name}`,
      description: def.description,
      metadata,
      searchKey: 'planSlug',
      searchValue: def.slug,
    });

    const monthly = await ensurePrice({
      productId: product.id,
      existingPriceId: currentPriceId,
      spec: { amountCents: Math.round(def.price * 100), interval: 'month' },
      metadata,
    });

    // Prezzo annuale sullo stesso prodotto: 12 mesi al prezzo di 10
    const yearly = await ensurePrice({
      productId: product.id,
      existingPriceId: plan.stripeYearlyPriceId,
      spec: { amountCents: Math.round(yearlyPriceOf(def.price) * 100), interval: 'year' },
      metadata,
    });

    if (plan.stripePriceId !== monthly.priceId || plan.stripeYearlyPriceId !== yearly.priceId) {
      await prisma.plan.update({
        where: { slug: def.slug },
        data: { stripePriceId: monthly.priceId, stripeYearlyPriceId: yearly.priceId },
      });
    }

    const action: SyncAction = created
      ? 'created'
      : monthly.rotated || yearly.rotated
        ? 'price_rotated'
        : 'unchanged';

    results.push({
      kind: 'plan',
      key: def.slug,
      productId: product.id,
      priceId: monthly.priceId,
      yearlyPriceId: yearly.priceId,
      action,
    });
  }

  return results;
}

/**
 * Risolve un piano da uno Stripe price ID, mensile o annuale.
 * Da usare ovunque si mappa un prezzo Stripe a un Plan (webhook in primis):
 * un abbonamento annuale ha il price id in stripeYearlyPriceId, non in
 * stripePriceId.
 */
export async function findPlanByStripePriceId(prisma: PrismaClient, priceId: string) {
  return prisma.plan.findFirst({
    where: { OR: [{ stripePriceId: priceId }, { stripeYearlyPriceId: priceId }] },
  });
}

/** Sincronizza i 4 add-on su Stripe e aggiorna AddonCatalog. */
export async function syncAddonsToStripe(prisma: PrismaClient): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const def of Object.values(ADDON_CATALOG)) {
    const row = await prisma.addonCatalog.findUnique({ where: { type: def.type } });

    const { productId, priceId, action } = await ensureProductAndPrice({
      existingProductId: row?.stripeProductId,
      existingPriceId: row?.stripePriceId,
      name: `InsegnaMi Add-on: ${def.name}`,
      description: def.description,
      spec: { amountCents: Math.round(def.unitPrice * 100), interval: 'month' },
      metadata: { addonType: def.type },
      searchKey: 'addonType',
      searchValue: def.type,
    });

    await prisma.addonCatalog.upsert({
      where: { type: def.type },
      create: {
        type: def.type,
        stripeProductId: productId,
        stripePriceId: priceId,
        priceAmount: def.unitPrice,
        syncedAt: new Date(),
      },
      update: {
        stripeProductId: productId,
        stripePriceId: priceId,
        priceAmount: def.unitPrice,
        syncedAt: new Date(),
      },
    });

    results.push({ kind: 'addon', key: def.type, productId, priceId, action });
  }

  return results;
}

/** Sync completa: piani in DB → piani su Stripe → add-on su Stripe. */
export async function syncAllToStripe(prisma: PrismaClient): Promise<SyncResult[]> {
  if (!isStripeEnabled()) {
    throw new Error(
      'STRIPE_SECRET_KEY non configurata o placeholder: sync non necessaria in dev billing.'
    );
  }
  await ensurePlansInDb(prisma);
  const planResults = await syncPlansToStripe(prisma);
  const addonResults = await syncAddonsToStripe(prisma);
  return [...planResults, ...addonResults];
}

/** Mappa stripePriceId → AddonType, usata dal webhook per riconoscere gli item add-on. */
export async function getAddonPriceMap(prisma: PrismaClient): Promise<Map<string, AddonType>> {
  const rows = await prisma.addonCatalog.findMany({
    where: { stripePriceId: { not: null } },
  });
  return new Map(rows.map((r) => [r.stripePriceId as string, r.type]));
}
