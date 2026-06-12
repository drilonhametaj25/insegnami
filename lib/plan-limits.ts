import { prisma } from '@/lib/db';
import { getActiveUsage, getAddonExtras } from '@/lib/billing/plan-change';

interface PlanLimits {
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
}

interface LimitCheckResult {
  allowed: boolean;
  limit: number | null;
  current: number;
  remaining: number | null;
  message?: string;
}

/**
 * Get the plan limits for a tenant
 */
export async function getTenantPlanLimits(tenantId: string): Promise<PlanLimits | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: {
          plan: {
            select: {
              maxStudents: true,
              maxTeachers: true,
              maxClasses: true,
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    return null;
  }

  // If tenant has active subscription with plan, use those limits + add-on extras.
  // null (illimitato) resta illimitato. getAddonExtras è condivisa con
  // lib/billing/plan-change per garantire la stessa semantica ovunque.
  if (tenant.subscription?.plan) {
    const extras = await getAddonExtras(tenantId);
    const withExtra = (base: number | null, extra: number) => (base == null ? null : base + extra);
    return {
      maxStudents: withExtra(tenant.subscription.plan.maxStudents, extras.students),
      maxTeachers: withExtra(tenant.subscription.plan.maxTeachers, extras.teachers),
      maxClasses: withExtra(tenant.subscription.plan.maxClasses, extras.classes),
    };
  }

  // If tenant is in trial, allow default limits (can be configured)
  if (tenant.trialUntil && new Date(tenant.trialUntil) > new Date()) {
    // Trial limits - generous for testing
    return {
      maxStudents: 50,
      maxTeachers: 10,
      maxClasses: 20,
    };
  }

  // No subscription and no trial - very limited
  return {
    maxStudents: 10,
    maxTeachers: 2,
    maxClasses: 5,
  };
}

/**
 * Costruisce il risultato del check a partire da limite e conteggio attivo.
 * Semantica unificata con lib/billing/plan-change: contano solo le risorse
 * ATTIVE (studenti/docenti status ACTIVE, classi isActive true) — le risorse
 * disattivate non occupano posti del piano.
 */
function buildLimitResult(
  limit: number | null,
  current: number,
  limitMessage: string
): LimitCheckResult {
  // null means unlimited
  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      current,
      remaining: null,
    };
  }

  const remaining = limit - current;
  const allowed = current < limit;

  return {
    allowed,
    limit,
    current,
    remaining: Math.max(0, remaining),
    message: allowed ? undefined : limitMessage,
  };
}

/**
 * Check if tenant can add more students
 */
export async function checkStudentLimit(tenantId: string): Promise<LimitCheckResult> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits) {
    return {
      allowed: false,
      limit: 0,
      current: 0,
      remaining: 0,
      message: 'Tenant non trovato',
    };
  }

  const usage = await getActiveUsage(tenantId);

  return buildLimitResult(
    limits.maxStudents,
    usage.students,
    `Limite studenti raggiunto (${limits.maxStudents}). Effettua l'upgrade del piano per aggiungere più studenti.`
  );
}

/**
 * Check if tenant can add more teachers
 */
export async function checkTeacherLimit(tenantId: string): Promise<LimitCheckResult> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits) {
    return {
      allowed: false,
      limit: 0,
      current: 0,
      remaining: 0,
      message: 'Tenant non trovato',
    };
  }

  const usage = await getActiveUsage(tenantId);

  return buildLimitResult(
    limits.maxTeachers,
    usage.teachers,
    `Limite docenti raggiunto (${limits.maxTeachers}). Effettua l'upgrade del piano per aggiungere più docenti.`
  );
}

/**
 * Check if tenant can add more classes
 */
export async function checkClassLimit(tenantId: string): Promise<LimitCheckResult> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits) {
    return {
      allowed: false,
      limit: 0,
      current: 0,
      remaining: 0,
      message: 'Tenant non trovato',
    };
  }

  const usage = await getActiveUsage(tenantId);

  return buildLimitResult(
    limits.maxClasses,
    usage.classes,
    `Limite classi raggiunto (${limits.maxClasses}). Effettua l'upgrade del piano per aggiungere più classi.`
  );
}

/**
 * Get all usage stats for a tenant with limits
 */
export async function getTenantUsageWithLimits(tenantId: string) {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits) {
    return null;
  }

  // Conteggi attivi condivisi con plan-change: stessa semantica della
  // validazione cambio piano (downgrade) e dei check sulle singole risorse.
  const usage = await getActiveUsage(tenantId);

  return {
    students: {
      current: usage.students,
      limit: limits.maxStudents,
      percentage: limits.maxStudents ? Math.round((usage.students / limits.maxStudents) * 100) : 0,
    },
    teachers: {
      current: usage.teachers,
      limit: limits.maxTeachers,
      percentage: limits.maxTeachers ? Math.round((usage.teachers / limits.maxTeachers) * 100) : 0,
    },
    classes: {
      current: usage.classes,
      limit: limits.maxClasses,
      percentage: limits.maxClasses ? Math.round((usage.classes / limits.maxClasses) * 100) : 0,
    },
  };
}
