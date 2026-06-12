import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

export type TenantAccessVerdict =
  | { ok: true }
  | { ok: false; reason: 'tenant-not-found' | 'tenant-inactive' | 'trial-expired' | 'subscription-cancelled' | 'subscription-past-due' };

/**
 * Decide whether a tenant should be allowed to use the system right now.
 *
 * Rules (most permissive wins):
 *   - Tenant.isActive = false        → blocked
 *   - Subscription ACTIVE / TRIALING → allowed
 *   - Subscription PAST_DUE          → blocked (Stripe will retry; while it
 *                                      retries the customer should contact
 *                                      support, NOT keep operating)
 *   - Subscription CANCELLED/UNPAID  → blocked
 *   - No Subscription + Trial active → allowed
 *   - No Subscription + Trial expired→ blocked
 *
 * SUPERADMIN access is gated separately at the route layer, not here. This
 * function only decides whether the tenant's data plane should respond.
 */
export async function checkTenantAccess(tenantId: string): Promise<TenantAccessVerdict> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      isActive: true,
      trialUntil: true,
      subscription: {
        select: { status: true, currentPeriodEnd: true },
      },
    },
  });

  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  if (!tenant.isActive) return { ok: false, reason: 'tenant-inactive' };

  const sub = tenant.subscription;
  if (sub) {
    if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') return { ok: true };
    if (sub.status === 'PAST_DUE') return { ok: false, reason: 'subscription-past-due' };
    return { ok: false, reason: 'subscription-cancelled' };
  }

  const trialAlive = tenant.trialUntil && tenant.trialUntil.getTime() > Date.now();
  if (trialAlive) return { ok: true };
  return { ok: false, reason: 'trial-expired' };
}

// Il verdetto viene cacheato brevemente: l'enforcement è per-request su
// (quasi) tutte le route dati e una query tenant+subscription a richiesta
// sarebbe sprecata. 60s di staleness è accettabile: i cambi di stato billing
// passano dai webhook/endpoint che invalidano esplicitamente la cache.
const ACCESS_CACHE_TTL_SECONDS = 60;
const accessCacheKey = (tenantId: string) => `tenant:access:${tenantId}`;

export async function getTenantAccessCached(tenantId: string): Promise<TenantAccessVerdict> {
  const cached = (await redis.getJSON(accessCacheKey(tenantId))) as TenantAccessVerdict | null;
  if (cached) return cached;

  const verdict = await checkTenantAccess(tenantId);
  await redis.setJSON(accessCacheKey(tenantId), verdict, ACCESS_CACHE_TTL_SECONDS);
  return verdict;
}

export async function invalidateTenantAccessCache(tenantId: string): Promise<void> {
  await redis.del(accessCacheKey(tenantId));
}

/**
 * Cron-target: deactivate tenants whose trial has expired AND who have no
 * active subscription. Called by lib/workers/cron-scheduler daily.
 *
 * This is the safety net — checkTenantAccess() runs per-request, but for
 * idle tenants (no traffic) we still want isActive flipped so dashboards
 * for SUPERADMIN show the correct billing state.
 */
export async function deactivateExpiredTenants(): Promise<{ deactivated: number }> {
  const now = new Date();
  const where = {
    isActive: true,
    trialUntil: { lt: now },
    OR: [
      { subscription: null },
      { subscription: { status: { in: ['CANCELLED', 'UNPAID'] as ('CANCELLED' | 'UNPAID')[] } } },
    ],
  };

  const targets = await prisma.tenant.findMany({ where, select: { id: true } });
  if (targets.length === 0) return { deactivated: 0 };

  const result = await prisma.tenant.updateMany({ where, data: { isActive: false } });
  await Promise.all(targets.map((t) => invalidateTenantAccessCache(t.id)));
  return { deactivated: result.count };
}
