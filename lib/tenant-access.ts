import { prisma } from '@/lib/db';

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
  const result = await prisma.tenant.updateMany({
    where: {
      isActive: true,
      trialUntil: { lt: now },
      OR: [
        { subscription: null },
        { subscription: { status: { in: ['CANCELLED', 'UNPAID'] } } },
      ],
    },
    data: { isActive: false },
  });
  return { deactivated: result.count };
}
