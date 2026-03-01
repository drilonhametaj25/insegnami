import { prisma } from '@/lib/db';

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

  // If tenant has active subscription with plan, use those limits
  if (tenant.subscription?.plan) {
    return {
      maxStudents: tenant.subscription.plan.maxStudents,
      maxTeachers: tenant.subscription.plan.maxTeachers,
      maxClasses: tenant.subscription.plan.maxClasses,
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

  const currentCount = await prisma.student.count({
    where: { tenantId },
  });

  // null means unlimited
  if (limits.maxStudents === null) {
    return {
      allowed: true,
      limit: null,
      current: currentCount,
      remaining: null,
    };
  }

  const remaining = limits.maxStudents - currentCount;
  const allowed = currentCount < limits.maxStudents;

  return {
    allowed,
    limit: limits.maxStudents,
    current: currentCount,
    remaining: Math.max(0, remaining),
    message: allowed
      ? undefined
      : `Limite studenti raggiunto (${limits.maxStudents}). Effettua l'upgrade del piano per aggiungere più studenti.`,
  };
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

  const currentCount = await prisma.teacher.count({
    where: { tenantId },
  });

  if (limits.maxTeachers === null) {
    return {
      allowed: true,
      limit: null,
      current: currentCount,
      remaining: null,
    };
  }

  const remaining = limits.maxTeachers - currentCount;
  const allowed = currentCount < limits.maxTeachers;

  return {
    allowed,
    limit: limits.maxTeachers,
    current: currentCount,
    remaining: Math.max(0, remaining),
    message: allowed
      ? undefined
      : `Limite docenti raggiunto (${limits.maxTeachers}). Effettua l'upgrade del piano per aggiungere più docenti.`,
  };
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

  const currentCount = await prisma.class.count({
    where: { tenantId },
  });

  if (limits.maxClasses === null) {
    return {
      allowed: true,
      limit: null,
      current: currentCount,
      remaining: null,
    };
  }

  const remaining = limits.maxClasses - currentCount;
  const allowed = currentCount < limits.maxClasses;

  return {
    allowed,
    limit: limits.maxClasses,
    current: currentCount,
    remaining: Math.max(0, remaining),
    message: allowed
      ? undefined
      : `Limite classi raggiunto (${limits.maxClasses}). Effettua l'upgrade del piano per aggiungere più classi.`,
  };
}

/**
 * Get all usage stats for a tenant with limits
 */
export async function getTenantUsageWithLimits(tenantId: string) {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits) {
    return null;
  }

  const [studentCount, teacherCount, classCount] = await Promise.all([
    prisma.student.count({ where: { tenantId } }),
    prisma.teacher.count({ where: { tenantId } }),
    prisma.class.count({ where: { tenantId } }),
  ]);

  return {
    students: {
      current: studentCount,
      limit: limits.maxStudents,
      percentage: limits.maxStudents ? Math.round((studentCount / limits.maxStudents) * 100) : 0,
    },
    teachers: {
      current: teacherCount,
      limit: limits.maxTeachers,
      percentage: limits.maxTeachers ? Math.round((teacherCount / limits.maxTeachers) * 100) : 0,
    },
    classes: {
      current: classCount,
      limit: limits.maxClasses,
      percentage: limits.maxClasses ? Math.round((classCount / limits.maxClasses) * 100) : 0,
    },
  };
}
