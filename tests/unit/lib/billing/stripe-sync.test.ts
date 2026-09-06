/**
 * Sync idempotente del catalogo commerciale su Stripe (B1.2):
 * - prima run: crea prodotti+prezzi (action 'created');
 * - seconda run: nessuna modifica (action 'unchanged');
 * - cambio prezzo nel catalogo: nuovo prezzo + archive del vecchio
 *   (action 'price_rotated');
 * - naming con prefisso "InsegnaMi" e metadata platform su product e price.
 *
 * Il client Stripe (lib/stripe) è mockato con uno stato in-memory.
 */

jest.mock('@/lib/stripe', () => {
  const PLATFORM_METADATA = { platform: 'InsegnaMi' };
  // Stato in-memory definito DENTRO la factory (jest.mock è hoistato sopra
  // qualunque const di modulo); esposto ai test via __state.
  const state = {
    products: new Map<string, any>(),
    prices: new Map<string, any>(),
    counter: 0,
  };
  const missingResourceError = (): Error => {
    const err: any = new Error('No such resource');
    err.code = 'resource_missing';
    return err;
  };
  return {
    __state: state,
    PLATFORM_METADATA,
    stripe: {
      products: {
        retrieve: jest.fn(async (id: string) => {
          const product = state.products.get(id);
          if (!product) throw missingResourceError();
          return product;
        }),
        search: jest.fn(async ({ query }: { query: string }) => {
          const conditions = [...query.matchAll(/metadata\['([^']+)'\]:'([^']+)'/g)];
          const data = [...state.products.values()].filter((p) =>
            conditions.every(([, key, value]) => p.metadata?.[key] === value)
          );
          return { data: data.slice(0, 1) };
        }),
        create: jest.fn(async (params: any) => {
          const id = `prod_${++state.counter}`;
          const product = { id, deleted: false, ...params };
          state.products.set(id, product);
          return product;
        }),
        update: jest.fn(async (id: string, params: any) => {
          const product = state.products.get(id);
          if (!product) throw missingResourceError();
          Object.assign(product, params);
          return product;
        }),
      },
      prices: {
        retrieve: jest.fn(async (id: string) => {
          const price = state.prices.get(id);
          if (!price) throw missingResourceError();
          return price;
        }),
      },
    },
    createNewPrice: jest.fn(async ({ productId, priceAmount, interval, metadata }: any) => {
      const id = `price_${++state.counter}`;
      const price = {
        id,
        product: productId,
        active: true,
        currency: 'eur',
        unit_amount: priceAmount,
        recurring: { interval },
        metadata: { ...PLATFORM_METADATA, ...metadata },
      };
      state.prices.set(id, price);
      return price;
    }),
    deactivatePrice: jest.fn(async (id: string) => {
      const price = state.prices.get(id);
      if (!price) throw missingResourceError();
      price.active = false;
      return price;
    }),
  };
});

jest.mock('@/lib/billing/billing-mode', () => ({
  isStripeEnabled: jest.fn(() => true),
  isDevBilling: jest.fn(() => false),
  TRIAL_DAYS: 14,
}));

import { syncAllToStripe } from '@/lib/billing/stripe-sync';
import { PLAN_CATALOG, yearlyPriceOf } from '@/lib/billing/plans-catalog';
import { ADDON_CATALOG } from '@/lib/billing/addons';

const { createNewPrice, deactivatePrice, stripe, __state: mockStripeState } = require('@/lib/stripe');

/** Fake Prisma in-memory: solo i modelli toccati dalla sync. */
function createFakePrisma() {
  const plans = new Map<string, any>();
  const addons = new Map<string, any>();
  return {
    plan: {
      findUnique: jest.fn(async ({ where: { slug } }: any) => plans.get(slug) ?? null),
      create: jest.fn(async ({ data }: any) => {
        plans.set(data.slug, { ...data });
        return plans.get(data.slug);
      }),
      update: jest.fn(async ({ where: { slug }, data }: any) => {
        Object.assign(plans.get(slug), data);
        return plans.get(slug);
      }),
    },
    addonCatalog: {
      findUnique: jest.fn(async ({ where: { type } }: any) => addons.get(type) ?? null),
      upsert: jest.fn(async ({ where: { type }, create, update }: any) => {
        if (addons.has(type)) Object.assign(addons.get(type), update);
        else addons.set(type, { ...create });
        return addons.get(type);
      }),
    },
  } as any;
}

const TOTAL_ITEMS = PLAN_CATALOG.length + Object.keys(ADDON_CATALOG).length;
const originalStarterPrice = PLAN_CATALOG[0].price;

describe('syncAllToStripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeState.products.clear();
    mockStripeState.prices.clear();
    mockStripeState.counter = 0;
    PLAN_CATALOG[0].price = originalStarterPrice;
  });

  afterAll(() => {
    PLAN_CATALOG[0].price = originalStarterPrice;
  });

  it('prima run: crea tutti i prodotti e prezzi (action created)', async () => {
    const prisma = createFakePrisma();
    const results = await syncAllToStripe(prisma);

    expect(results).toHaveLength(TOTAL_ITEMS);
    expect(results.every((r) => r.action === 'created')).toBe(true);
    expect(mockStripeState.products.size).toBe(TOTAL_ITEMS);
    // piani E add-on hanno DUE prezzi (mensile + annuale)
    expect(mockStripeState.prices.size).toBe(TOTAL_ITEMS * 2);

    // annuale: 12 mesi al prezzo di 10, interval year, stesso prodotto del mensile
    for (const r of results.filter((x) => x.kind === 'plan')) {
      const def = PLAN_CATALOG.find((d) => d.slug === r.key)!;
      const monthly = mockStripeState.prices.get(r.priceId);
      const yearly = mockStripeState.prices.get(r.yearlyPriceId!);
      expect(monthly.recurring.interval).toBe('month');
      expect(yearly.recurring.interval).toBe('year');
      expect(yearly.unit_amount).toBe(Math.round(yearlyPriceOf(def.price) * 100));
      expect(yearly.product).toBe(monthly.product);
    }
    // anche gli add-on hanno il prezzo annuale (mensile×10, stesso prodotto):
    // Stripe rifiuta interval misti nella stessa subscription
    for (const r of results.filter((x) => x.kind === 'addon')) {
      const def = ADDON_CATALOG[r.key as keyof typeof ADDON_CATALOG];
      const monthly = mockStripeState.prices.get(r.priceId);
      const yearly = mockStripeState.prices.get(r.yearlyPriceId!);
      expect(monthly.recurring.interval).toBe('month');
      expect(yearly.recurring.interval).toBe('year');
      expect(yearly.unit_amount).toBe(Math.round(yearlyPriceOf(def.unitPrice) * 100));
      expect(yearly.product).toBe(monthly.product);
    }
  });

  it('seconda run: idempotente, tutte le action sono unchanged', async () => {
    const prisma = createFakePrisma();
    await syncAllToStripe(prisma);
    createNewPrice.mockClear();
    stripe.products.create.mockClear();

    const second = await syncAllToStripe(prisma);

    expect(second).toHaveLength(TOTAL_ITEMS);
    expect(second.every((r) => r.action === 'unchanged')).toBe(true);
    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(createNewPrice).not.toHaveBeenCalled();
    expect(deactivatePrice).not.toHaveBeenCalled();
  });

  it('cambio prezzo nel catalogo: price_rotated con archive del vecchio prezzo', async () => {
    const prisma = createFakePrisma();
    const first = await syncAllToStripe(prisma);
    const starterFirst = first.find((r) => r.kind === 'plan' && r.key === PLAN_CATALOG[0].slug)!;

    PLAN_CATALOG[0].price = originalStarterPrice + 10;
    const second = await syncAllToStripe(prisma);
    const starterSecond = second.find((r) => r.kind === 'plan' && r.key === PLAN_CATALOG[0].slug)!;

    expect(starterSecond.action).toBe('price_rotated');
    expect(starterSecond.priceId).not.toBe(starterFirst.priceId);
    // ruota anche l'annuale (derivato dal mensile: 12 mesi al prezzo di 10)
    expect(starterSecond.yearlyPriceId).not.toBe(starterFirst.yearlyPriceId);
    // i vecchi prezzi sono archiviati, non cancellati
    expect(deactivatePrice).toHaveBeenCalledWith(starterFirst.priceId);
    expect(deactivatePrice).toHaveBeenCalledWith(starterFirst.yearlyPriceId);
    expect(mockStripeState.prices.get(starterFirst.priceId).active).toBe(false);
    expect(mockStripeState.prices.get(starterFirst.yearlyPriceId!).active).toBe(false);
    // gli altri item restano unchanged
    const others = second.filter((r) => r.key !== PLAN_CATALOG[0].slug);
    expect(others.every((r) => r.action === 'unchanged')).toBe(true);
  });

  it('i prodotti hanno il prefisso "InsegnaMi" nel nome', async () => {
    const prisma = createFakePrisma();
    await syncAllToStripe(prisma);
    const names = [...mockStripeState.products.values()].map((p) => p.name);
    expect(names).toHaveLength(TOTAL_ITEMS);
    for (const name of names) {
      expect(name).toMatch(/^InsegnaMi/);
    }
  });

  it('product e price portano i metadata platform + chiave di ricerca', async () => {
    const prisma = createFakePrisma();
    await syncAllToStripe(prisma);

    for (const product of mockStripeState.products.values()) {
      expect(product.metadata.platform).toBe('InsegnaMi');
      expect(product.metadata.planSlug ?? product.metadata.addonType).toBeDefined();
    }
    for (const price of mockStripeState.prices.values()) {
      expect(price.metadata.platform).toBe('InsegnaMi');
    }
    // la sync passa la chiave di ricerca anche al prezzo
    for (const call of createNewPrice.mock.calls) {
      const metadata = call[0].metadata;
      expect(metadata.planSlug ?? metadata.addonType).toBeDefined();
    }
  });

  it('priceId stale di un prodotto legacy (stesso importo): crea il prezzo sul prodotto nuovo', async () => {
    // Regressione incidente 12/06/2026: i prodotti legacy "InsegnaMi - X"
    // (senza metadata platform) non sono trovati dalla search → la sync crea
    // prodotti nuovi; ma Plan.stripePriceId puntava ai prezzi legacy con lo
    // stesso importo, isPriceValid li accettava e i prodotti nuovi restavano
    // SENZA prezzo. Il prezzo deve invece appartenere al prodotto risolto.
    const starter = PLAN_CATALOG[0];
    mockStripeState.products.set('prod_legacy', {
      id: 'prod_legacy',
      deleted: false,
      name: `InsegnaMi - ${starter.name}`,
      metadata: {}, // niente platform/planSlug: invisibile alla search della sync
    });
    mockStripeState.prices.set('price_legacy', {
      id: 'price_legacy',
      product: 'prod_legacy',
      active: true,
      currency: 'eur',
      unit_amount: Math.round(starter.price * 100), // stesso importo del catalogo
      recurring: { interval: 'month' },
      metadata: {},
    });

    const prisma = createFakePrisma();
    await prisma.plan.create({
      data: { ...starter, stripePriceId: 'price_legacy', isActive: true },
    });

    const results = await syncAllToStripe(prisma);
    const starterResult = results.find((r) => r.kind === 'plan' && r.key === starter.slug)!;

    // Prodotto nuovo creato (il legacy non è riconosciuto) con un prezzo SUO
    expect(starterResult.productId).not.toBe('prod_legacy');
    expect(starterResult.priceId).not.toBe('price_legacy');
    const newPrice = mockStripeState.prices.get(starterResult.priceId);
    expect(newPrice.product).toBe(starterResult.productId);
    expect(newPrice.unit_amount).toBe(Math.round(starter.price * 100));
    // Il DB punta al prezzo nuovo e il prezzo legacy è archiviato
    const row = await prisma.plan.findUnique({ where: { slug: starter.slug } });
    expect(row.stripePriceId).toBe(starterResult.priceId);
    expect(mockStripeState.prices.get('price_legacy').active).toBe(false);
    // Il prodotto legacy non viene toccato dalla sync (lo gestisce il cleanup)
    expect(mockStripeState.products.get('prod_legacy').deleted).toBe(false);
  });

  it('persiste gli ID Stripe: Plan.stripePriceId reale e AddonCatalog completo', async () => {
    const prisma = createFakePrisma();
    const results = await syncAllToStripe(prisma);

    for (const def of PLAN_CATALOG) {
      const row = await prisma.plan.findUnique({ where: { slug: def.slug } });
      expect(row.stripePriceId).toMatch(/^price_\d+$/); // niente placeholder *_dev
      expect(row.stripeYearlyPriceId).toMatch(/^price_\d+$/);
    }
    expect(prisma.addonCatalog.upsert).toHaveBeenCalledTimes(Object.keys(ADDON_CATALOG).length);
    expect(results.filter((r) => r.kind === 'addon')).toHaveLength(
      Object.keys(ADDON_CATALOG).length
    );
    // AddonCatalog persiste ANCHE il prezzo annuale
    for (const def of Object.values(ADDON_CATALOG)) {
      const row = await prisma.addonCatalog.findUnique({ where: { type: def.type } });
      expect(row.stripePriceId).toMatch(/^price_\d+$/);
      expect(row.stripeYearlyPriceId).toMatch(/^price_\d+$/);
      expect(row.stripeYearlyPriceId).not.toBe(row.stripePriceId);
    }
  });

  it('seconda run add-on: il prezzo annuale esistente viene riusato (idempotenza)', async () => {
    const prisma = createFakePrisma();
    const first = await syncAllToStripe(prisma);
    const second = await syncAllToStripe(prisma);

    for (const def of Object.values(ADDON_CATALOG)) {
      const firstRow = first.find((r) => r.kind === 'addon' && r.key === def.type)!;
      const secondRow = second.find((r) => r.kind === 'addon' && r.key === def.type)!;
      expect(secondRow.action).toBe('unchanged');
      expect(secondRow.yearlyPriceId).toBe(firstRow.yearlyPriceId);
    }
  });
});
