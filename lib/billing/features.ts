/**
 * Feature gating per piano: unica fonte di verità runtime per "questo tenant
 * ha diritto alla funzionalità X?".
 *
 * Risoluzione (in ordine):
 *   1. Subscription→Plan.features (JSON persistito, sincronizzato dal catalogo)
 *   2. fallback: tenant.plan (slug, normalizzato lowercase) → PLAN_CATALOG
 *   3. override per-tenant: Tenant.featureFlags (vince sempre, sia true che false
 *      — è la leva del superadmin per comp/pilot)
 *
 * Cache Redis 60s con invalidazione esplicita dagli stessi punti che
 * invalidano tenant-access (webhook Stripe, change-plan, superadmin).
 */

import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { PLAN_CATALOG } from './plans-catalog';
import type { FeatureKey } from './feature-catalog';

// Definizioni statiche (chiavi, etichette, piano minimo) spostate nel modulo
// puro feature-catalog.ts (client-safe); ri-esportate qui per compatibilità.
export {
  ALL_FEATURE_KEYS,
  FEATURE_LABELS,
  FEATURE_MIN_PLAN,
  featureBadgeLabel,
} from './feature-catalog';
export type { FeatureKey } from './feature-catalog';

const FEATURE_CACHE_TTL_SECONDS = 60;
const featureCacheKey = (tenantId: string) => `tenant:features:${tenantId}`;

function catalogFeaturesForSlug(slug: string | null | undefined): Record<string, boolean> {
  if (!slug) return {};
  const normalized = slug.toLowerCase();
  const plan = PLAN_CATALOG.find((p) => p.slug === normalized);
  return plan?.features ?? {};
}

function asBooleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * Mappa effettiva feature→bool del tenant (piano + override), non cacheata.
 */
export async function computeEffectiveFeatures(tenantId: string): Promise<Record<string, boolean>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      featureFlags: true,
      trialUntil: true,
      subscription: {
        select: {
          status: true,
          trialEnd: true,
          plan: { select: { slug: true, features: true } },
        },
      },
    },
  });

  if (!tenant) return {};

  // 1) features del piano della subscription (persistite), 2) catalogo
  const subPlan = tenant.subscription?.plan;
  const persisted = asBooleanRecord(subPlan?.features);
  let planFeatures =
    Object.keys(persisted).length > 0
      ? persisted
      : catalogFeaturesForSlug(subPlan?.slug ?? tenant.plan);

  // 2-bis) TRIAL COMPLETO: durante la prova (trial senza subscription, o
  // subscription TRIALING) senza un piano risolvibile a catalogo, l'utente
  // deve poter provare le feature del piano consigliato (Professional).
  // Bloccare fatture/payroll/analytics a chi sta valutando ucciderebbe la
  // conversione. Le feature Enterprise restano fuori (override superadmin).
  if (Object.keys(planFeatures).length === 0) {
    const now = Date.now();
    const trialing =
      (tenant.subscription?.status === 'TRIALING' &&
        (!tenant.subscription.trialEnd || tenant.subscription.trialEnd.getTime() > now)) ||
      (!tenant.subscription && tenant.trialUntil != null && tenant.trialUntil.getTime() > now);
    if (trialing) {
      planFeatures = catalogFeaturesForSlug('professional');
    }
  }

  // 3) override per-tenant (vince sempre)
  const overrides = asBooleanRecord(tenant.featureFlags);

  return { ...planFeatures, ...overrides };
}

export async function getEffectiveFeatures(tenantId: string): Promise<Record<string, boolean>> {
  const cached = (await redis.getJSON(featureCacheKey(tenantId))) as Record<string, boolean> | null;
  if (cached) return cached;

  const features = await computeEffectiveFeatures(tenantId);
  await redis.setJSON(featureCacheKey(tenantId), features, FEATURE_CACHE_TTL_SECONDS);
  return features;
}

export async function hasFeature(tenantId: string, key: FeatureKey): Promise<boolean> {
  const features = await getEffectiveFeatures(tenantId);
  return features[key] === true;
}

export async function invalidateFeatureCache(tenantId: string): Promise<void> {
  await redis.del(featureCacheKey(tenantId));
}
