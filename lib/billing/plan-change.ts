import { prisma } from '@/lib/db';
import type { AddonType } from '@prisma/client';
import { getAddonDefinition } from './addons';

/**
 * Validazione dei cambi piano e della rimozione add-on rispetto alle risorse
 * realmente in uso dal tenant. Un downgrade è permesso solo se studenti,
 * docenti e classi ATTIVI rientrano nei limiti del piano target (più gli
 * add-on attivi). Vale in entrambe le modalità billing (dev e Stripe).
 */

export interface PlanChangeViolation {
  resource: 'students' | 'teachers' | 'classes';
  label: string; // 'Studenti' | 'Docenti' | 'Classi'
  current: number; // conteggio attivo
  limit: number; // limite piano target + extra add-on
  excess: number; // current - limit
}

export interface PlanChangeValidation {
  allowed: boolean;
  violations: PlanChangeViolation[];
  message?: string; // italiano, pronto per la UI
}

interface TargetPlanLimits {
  name: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
}

/** Conteggio risorse attive (le sole che occupano posti del piano). */
export async function getActiveUsage(
  tenantId: string
): Promise<{ students: number; teachers: number; classes: number }> {
  const [students, teachers, classes] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.teacher.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.class.count({ where: { tenantId, isActive: true } }),
  ]);
  return { students, teachers, classes };
}

/** Somma i posti extra dagli add-on attivi, per tipo di risorsa. */
export async function getAddonExtras(
  tenantId: string
): Promise<{ students: number; teachers: number; classes: number }> {
  const addons = await prisma.tenantAddon.findMany({
    where: { tenantId, status: 'ACTIVE' },
  });
  const sum = (type: AddonType) =>
    addons.filter((a) => a.type === type).reduce((s, a) => s + a.quantity * a.unitSize, 0);
  return {
    students: sum('EXTRA_STUDENTS'),
    teachers: sum('EXTRA_TEACHERS'),
    classes: sum('EXTRA_CLASSES'),
  };
}

function buildViolations(
  usage: { students: number; teachers: number; classes: number },
  limits: { students: number | null; teachers: number | null; classes: number | null }
): PlanChangeViolation[] {
  const checks: Array<[PlanChangeViolation['resource'], string, number, number | null]> = [
    ['students', 'Studenti', usage.students, limits.students],
    ['teachers', 'Docenti', usage.teachers, limits.teachers],
    ['classes', 'Classi', usage.classes, limits.classes],
  ];

  const violations: PlanChangeViolation[] = [];
  for (const [resource, label, current, limit] of checks) {
    // null = illimitato → mai in violazione; il pari al limite è permesso
    if (limit != null && current > limit) {
      violations.push({ resource, label, current, limit, excess: current - limit });
    }
  }
  return violations;
}

function formatMessage(planName: string, violations: PlanChangeViolation[]): string {
  const parts = violations.map(
    (v) => `${v.label} attivi ${v.current} su un limite di ${v.limit} (eccedenza ${v.excess})`
  );
  return (
    `Impossibile passare al piano ${planName}: ${parts.join('; ')}. ` +
    `Riduci le risorse in eccesso o acquista add-on prima del downgrade.`
  );
}

/**
 * Verifica se il tenant può passare al piano target.
 * Limite effettivo per risorsa = limite del piano target + extra add-on attivi.
 * Gli upgrade passano automaticamente (l'uso rientra nei limiti più ampi).
 */
export async function validatePlanChange(
  tenantId: string,
  targetPlan: TargetPlanLimits
): Promise<PlanChangeValidation> {
  const [usage, extras] = await Promise.all([
    getActiveUsage(tenantId),
    getAddonExtras(tenantId),
  ]);

  const withExtra = (base: number | null, extra: number) => (base == null ? null : base + extra);
  const violations = buildViolations(usage, {
    students: withExtra(targetPlan.maxStudents, extras.students),
    teachers: withExtra(targetPlan.maxTeachers, extras.teachers),
    classes: withExtra(targetPlan.maxClasses, extras.classes),
  });

  if (violations.length === 0) {
    return { allowed: true, violations: [] };
  }
  return {
    allowed: false,
    violations,
    message: formatMessage(targetPlan.name, violations),
  };
}

/**
 * Verifica se il tenant può rimuovere `quantity` pacchetti dell'add-on `type`:
 * blocca la rimozione se il limite effettivo scenderebbe sotto l'uso attivo.
 * Gli add-on senza limitKey (storage) sono sempre rimovibili.
 */
export async function validateAddonRemoval(
  tenantId: string,
  type: AddonType,
  quantity: number = 1
): Promise<PlanChangeValidation> {
  const def = getAddonDefinition(type);
  if (!def.limitKey) {
    return { allowed: true, violations: [] };
  }

  const existing = await prisma.tenantAddon.findFirst({
    where: { tenantId, type, status: 'ACTIVE' },
  });
  if (!existing) {
    return { allowed: true, violations: [] };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { name: true, maxStudents: true, maxTeachers: true, maxClasses: true } } },
  });
  const plan = subscription?.plan;
  if (!plan) {
    return { allowed: true, violations: [] };
  }

  const [usage, extras] = await Promise.all([
    getActiveUsage(tenantId),
    getAddonExtras(tenantId),
  ]);

  // Posti che spariscono con la rimozione (snapshot unitSize della riga)
  const removedUnits = Math.min(quantity, existing.quantity) * existing.unitSize;
  const resourceKey =
    def.limitKey === 'maxStudents' ? 'students' : def.limitKey === 'maxTeachers' ? 'teachers' : 'classes';

  const newExtras = { ...extras, [resourceKey]: Math.max(0, extras[resourceKey] - removedUnits) };

  const withExtra = (base: number | null, extra: number) => (base == null ? null : base + extra);
  const violations = buildViolations(usage, {
    students: withExtra(plan.maxStudents, newExtras.students),
    teachers: withExtra(plan.maxTeachers, newExtras.teachers),
    classes: withExtra(plan.maxClasses, newExtras.classes),
  });

  if (violations.length === 0) {
    return { allowed: true, violations: [] };
  }
  const v = violations.find((x) => x.resource === resourceKey) ?? violations[0];
  return {
    allowed: false,
    violations,
    message:
      `Non puoi rimuovere questo add-on: hai ${v.current} ${v.label.toLowerCase()} attivi ` +
      `e il limite scenderebbe a ${v.limit}. Riduci prima le risorse in eccesso.`,
  };
}
