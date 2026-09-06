/**
 * Motore feature gating (lib/billing/features.ts): risoluzione
 * piano persistito → catalogo (slug normalizzato) → override per-tenant,
 * più il comportamento di requireAuth({feature}).
 */

const mockTenantFindUnique = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findUnique: (...args: any[]) => mockTenantFindUnique(...args) },
  },
}));

const mockRedisStore = new Map<string, any>();
jest.mock('@/lib/redis', () => ({
  redis: {
    getJSON: jest.fn(async (k: string) => mockRedisStore.get(k) ?? null),
    setJSON: jest.fn(async (k: string, v: any) => void mockRedisStore.set(k, v)),
    del: jest.fn(async (k: string) => void mockRedisStore.delete(k)),
  },
}));

import {
  hasFeature,
  getEffectiveFeatures,
  invalidateFeatureCache,
  ALL_FEATURE_KEYS,
  FEATURE_MIN_PLAN,
  type FeatureKey,
} from '@/lib/billing/features';
import { PLAN_CATALOG } from '@/lib/billing/plans-catalog';

function tenantRow(overrides: Record<string, any> = {}) {
  return {
    plan: 'starter',
    featureFlags: {},
    trialUntil: null,
    subscription: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisStore.clear();
});

describe('risoluzione feature per piano', () => {
  const CASES: Array<[string, FeatureKey, boolean]> = [
    ['starter', 'paymentReminders', true],
    ['starter', 'einvoicing', false],
    ['starter', 'payroll', false],
    ['starter', 'analytics', false],
    ['professional', 'einvoicing', true],
    ['professional', 'payroll', true],
    ['professional', 'analytics', true],
    ['professional', 'scheduleGenerator', true],
    ['professional', 'whiteLabel', false],
    ['professional', 'automationsConfig', false],
    ['enterprise', 'whiteLabel', true],
    ['enterprise', 'automationsConfig', true],
    ['enterprise', 'auditTrail', true],
  ];

  for (const [slug, key, expected] of CASES) {
    it(`${slug} → ${key} = ${expected} (fallback catalogo via tenant.plan)`, async () => {
      mockTenantFindUnique.mockResolvedValue(tenantRow({ plan: slug }));
      expect(await hasFeature('t1', key)).toBe(expected);
      mockRedisStore.clear();
    });
  }

  it('normalizza lo slug MAIUSCOLO scritto dal webhook Stripe', async () => {
    mockTenantFindUnique.mockResolvedValue(tenantRow({ plan: 'PROFESSIONAL' }));
    expect(await hasFeature('t1', 'payroll')).toBe(true);
  });

  it('preferisce le features persistite sul piano della subscription', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({
        plan: 'starter',
        subscription: {
          status: 'ACTIVE',
          plan: { slug: 'professional', features: { payroll: true } },
        },
      })
    );
    expect(await hasFeature('t1', 'payroll')).toBe(true);
    mockRedisStore.clear();
    // le persistite sono l'unica fonte quando presenti: analytics non c'è → false
    expect(await hasFeature('t1', 'analytics')).toBe(false);
  });

  it('con subscription ma features vuote ricade sul catalogo del piano della subscription', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({
        plan: 'starter',
        subscription: { status: 'ACTIVE', plan: { slug: 'enterprise', features: {} } },
      })
    );
    expect(await hasFeature('t1', 'whiteLabel')).toBe(true);
  });
});

describe('trial completo (fallback Professional durante la prova)', () => {
  const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const PAST = new Date(Date.now() - 24 * 3600 * 1000);

  it('trial attivo senza subscription e piano non a catalogo → feature Professional', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({ plan: 'basic', trialUntil: FUTURE })
    );
    expect(await hasFeature('t1', 'payroll')).toBe(true);
    mockRedisStore.clear();
    expect(await hasFeature('t1', 'einvoicing')).toBe(true);
    mockRedisStore.clear();
    // le feature Enterprise NON sono incluse nel trial
    expect(await hasFeature('t1', 'whiteLabel')).toBe(false);
  });

  it('trial scaduto senza subscription → nessuna feature', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({ plan: 'basic', trialUntil: PAST })
    );
    expect(await hasFeature('t1', 'payroll')).toBe(false);
  });

  it('subscription TRIALING con piano non risolvibile → feature Professional', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({
        plan: 'basic',
        subscription: {
          status: 'TRIALING',
          trialEnd: FUTURE,
          plan: { slug: 'sconosciuto', features: {} },
        },
      })
    );
    expect(await hasFeature('t1', 'accounting')).toBe(true);
  });

  it('il piano risolvibile vince sul fallback trial (starter resta starter anche in prova)', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({ plan: 'starter', trialUntil: FUTURE })
    );
    expect(await hasFeature('t1', 'payroll')).toBe(false);
  });
});

describe('override per-tenant (Tenant.featureFlags)', () => {
  it('un override true concede una feature fuori piano (comp del superadmin)', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({ plan: 'starter', featureFlags: { payroll: true } })
    );
    expect(await hasFeature('t1', 'payroll')).toBe(true);
  });

  it('un override false revoca una feature inclusa nel piano', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({ plan: 'enterprise', featureFlags: { whiteLabel: false } })
    );
    expect(await hasFeature('t1', 'whiteLabel')).toBe(false);
  });

  it('valori non booleani negli override vengono ignorati', async () => {
    mockTenantFindUnique.mockResolvedValue(
      tenantRow({ plan: 'starter', featureFlags: { payroll: 'yes', einvoicing: 1 } })
    );
    expect(await hasFeature('t1', 'payroll')).toBe(false);
    mockRedisStore.clear();
    expect(await hasFeature('t1', 'einvoicing')).toBe(false);
  });
});

describe('casi limite e cache', () => {
  it('tenant inesistente → nessuna feature', async () => {
    mockTenantFindUnique.mockResolvedValue(null);
    expect(await hasFeature('missing', 'paymentReminders')).toBe(false);
  });

  it('usa la cache: seconda lettura senza query DB', async () => {
    mockTenantFindUnique.mockResolvedValue(tenantRow({ plan: 'professional' }));
    await getEffectiveFeatures('t1');
    await getEffectiveFeatures('t1');
    expect(mockTenantFindUnique).toHaveBeenCalledTimes(1);
  });

  it('invalidateFeatureCache forza il ricalcolo', async () => {
    mockTenantFindUnique.mockResolvedValue(tenantRow({ plan: 'starter' }));
    await getEffectiveFeatures('t1');
    await invalidateFeatureCache('t1');
    await getEffectiveFeatures('t1');
    expect(mockTenantFindUnique).toHaveBeenCalledTimes(2);
  });
});

describe('coerenza catalogo ↔ chiavi di gating', () => {
  it('ogni feature dichiarata nel catalogo è una FeatureKey nota', () => {
    for (const plan of PLAN_CATALOG) {
      for (const key of Object.keys(plan.features)) {
        expect(ALL_FEATURE_KEYS).toContain(key);
      }
    }
  });

  it('FEATURE_MIN_PLAN è coerente col catalogo', () => {
    const bySlug = Object.fromEntries(PLAN_CATALOG.map((p) => [p.slug, p.features]));
    for (const key of ALL_FEATURE_KEYS) {
      const minPlan = FEATURE_MIN_PLAN[key];
      expect(bySlug[minPlan]?.[key]).toBe(true);
      if (minPlan === 'professional') expect(bySlug.starter[key]).toBeUndefined();
      if (minPlan === 'enterprise') {
        expect(bySlug.starter[key]).toBeUndefined();
        expect(bySlug.professional[key]).toBeUndefined();
      }
    }
  });
});

describe('requireAuth({feature})', () => {
  it('403 feature-not-in-plan quando il piano non include la feature', async () => {
    jest.resetModules();
    jest.doMock('@/lib/auth', () => ({
      getAuth: jest.fn().mockResolvedValue({
        user: { id: 'u1', tenantId: 't1', role: 'ADMIN', email: 'a@b.c' },
      }),
    }));
    jest.doMock('@/lib/tenant-access', () => ({
      getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
    }));
    mockTenantFindUnique.mockResolvedValue(tenantRow({ plan: 'starter' }));

    const { requireAuth } = require('@/lib/api-auth');
    await expect(requireAuth({ feature: 'payroll' })).rejects.toMatchObject({
      status: 403,
      code: 'feature-not-in-plan',
    });
  });

  it('SUPERADMIN bypassa il gating di feature', async () => {
    jest.resetModules();
    jest.doMock('@/lib/auth', () => ({
      getAuth: jest.fn().mockResolvedValue({
        user: { id: 'u1', tenantId: 't1', role: 'SUPERADMIN', email: 'sa@b.c' },
      }),
    }));
    jest.doMock('@/lib/tenant-access', () => ({
      getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
    }));

    const { requireAuth } = require('@/lib/api-auth');
    const ctx = await requireAuth({ feature: 'payroll' });
    expect(ctx.isSuperAdmin).toBe(true);
  });
});
