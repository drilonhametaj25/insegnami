import type { AddonType, PrismaClient } from '@prisma/client';
import { stripe, createNewPrice, deactivatePrice, PLATFORM_METADATA } from '@/lib/stripe';
import { ADDON_CATALOG } from './addons';
import { PLAN_CATALOG } from './plans-catalog';
import { isStripeEnabled } from './billing-mode';

/**
 * Sync idempotente del catalogo commerciale (3 piani + 4 add-on) su Stripe.
 *
 * - Crea il prodotto Stripe se manca (recovery via products.search sui
 *   metadata, così un DB perso non duplica i prodotti).
 * - Crea/ruota il prezzo se manca o se l'importo nel catalogo è cambiato
 *   (il vecchio prezzo viene archiviato: gli abbonamenti esistenti
 *   continuano a fatturare sul prezzo vecchio).
 * - Persiste gli ID: Plan.stripePriceId per i piani, AddonCatalog per gli add-on.
 *
 * Tutte le entità create portano metadata { platform: 'InsegnaMi' }.
 */

export type SyncAction = 'created' | 'price_rotated' | 'unchanged' | 'relinked';

export interface SyncResult {
  kind: 'plan' | 'addon';
  key: string; // slug piano o AddonType
  productId: string;
  priceId: string;
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

/** Il prezzo è ancora valido per la spec corrente del catalogo? */
async function isPriceValid(priceId: string | null | undefined, spec: PriceSpec): Promise<boolean> {
  if (!priceId) return false;
  try {
    const price = await stripe.prices.retrieve(priceId);
    return (
      price.active &&
      price.currency === 'eur' &&
      price.recurring?.interval === spec.interval &&
      price.unit_amount === spec.amountCents
    );
  } catch (err) {
    if (isMissingResourceError(err)) return false;
    throw err;
  }
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
  let product = await findProduct(existingProductId, searchKey, searchValue);
  let productCreated = false;

  if (!product) {
    product = await stripe.products.create({
      name,
      description,
      metadata: { ...PLATFORM_METADATA, ...metadata },
    });
    productCreated = true;
  } else if (product.name !== name || product.description !== description) {
    await stripe.products.update(product.id, { name, description });
  }

  if (await isPriceValid(existingPriceId, spec)) {
    // 'relinked' solo se il chiamante PERSISTEVA un productId diverso da
    // quello trovato: i piani non persistono il productId (sempre null),
    // quindi senza il check su existingProductId ogni run risulterebbe
    // erroneamente 'relinked' invece di 'unchanged'.
    const relinked = !productCreated && !!existingProductId && product.id !== existingProductId;
    return {
      productId: product.id,
      priceId: existingPriceId!,
      action: relinked ? 'relinked' : 'unchanged',
    };
  }

  const price = await createNewPrice({
    productId: product.id,
    priceAmount: spec.amountCents,
    interval: spec.interval,
    metadata,
  });

  // Archivia il vecchio prezzo se esisteva (gli item attivi non vengono toccati)
  if (existingPriceId && existingPriceId !== price.id) {
    try {
      await deactivatePrice(existingPriceId);
    } catch (err) {
      if (!isMissingResourceError(err)) throw err;
    }
  }

  return {
    productId: product.id,
    priceId: price.id,
    action: productCreated ? 'created' : 'price_rotated',
  };
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

/** Sincronizza i piani su Stripe e aggiorna Plan.stripePriceId. */
export async function syncPlansToStripe(prisma: PrismaClient): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const def of PLAN_CATALOG) {
    const plan = await prisma.plan.findUnique({ where: { slug: def.slug } });
    if (!plan) continue;

    // I placeholder dev (price_starter_dev, ...) non sono ID Stripe reali
    const currentPriceId = plan.stripePriceId?.endsWith('_dev') ? null : plan.stripePriceId;

    const { productId, priceId, action } = await ensureProductAndPrice({
      existingProductId: null, // i piani non persistono il productId: recovery via search
      existingPriceId: currentPriceId,
      name: `InsegnaMi ${def.name}`,
      description: def.description,
      spec: {
        amountCents: Math.round(def.price * 100),
        interval: def.interval === 'YEARLY' ? 'year' : 'month',
      },
      metadata: { planSlug: def.slug },
      searchKey: 'planSlug',
      searchValue: def.slug,
    });

    if (plan.stripePriceId !== priceId) {
      await prisma.plan.update({ where: { slug: def.slug }, data: { stripePriceId: priceId } });
    }

    results.push({ kind: 'plan', key: def.slug, productId, priceId, action });
  }

  return results;
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
