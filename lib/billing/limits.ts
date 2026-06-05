import { prisma } from '@/lib/db';
import { ADDON_CATALOG, PLAN_BASE_STORAGE_GB } from './addons';
import type { AddonType } from '@prisma/client';

export interface EffectiveLimits {
  maxStudents: number | null; // null = illimitato
  maxTeachers: number | null;
  maxClasses: number | null;
  storageBytes: number | null; // null = illimitato
  planSlug: string | null;
  addonExtras: {
    students: number;
    teachers: number;
    classes: number;
    storageGb: number;
  };
}

const GB = 1024 * 1024 * 1024;

/**
 * Calcola i limiti effettivi di un tenant: limiti del piano corrente
 * più gli add-on attivi. Restituisce null per i limiti illimitati.
 */
export async function getEffectiveLimits(tenantId: string): Promise<EffectiveLimits> {
  const [subscription, addons, tenant] = await Promise.all([
    prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    prisma.tenantAddon.findMany({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  const plan = subscription?.plan ?? null;
  const planSlug = plan?.slug ?? tenant?.plan ?? null;

  // Somma pacchetti add-on per tipo → entità extra
  const extraUnits = (type: AddonType) =>
    addons
      .filter((a) => a.type === type)
      .reduce((sum, a) => sum + a.quantity * a.unitSize, 0);

  const extraStudents = extraUnits('EXTRA_STUDENTS');
  const extraTeachers = extraUnits('EXTRA_TEACHERS');
  const extraClasses = extraUnits('EXTRA_CLASSES');
  const extraStorageGb = extraUnits('EXTRA_STORAGE');

  // Limite = limite piano + extra. null (illimitato) resta illimitato.
  const withExtra = (base: number | null | undefined, extra: number) =>
    base == null ? null : base + extra;

  const baseStorageGb = planSlug ? PLAN_BASE_STORAGE_GB[planSlug] ?? 1 : 1;
  const storageBytes =
    baseStorageGb == null ? null : (baseStorageGb + extraStorageGb) * GB;

  return {
    maxStudents: withExtra(plan?.maxStudents, extraStudents),
    maxTeachers: withExtra(plan?.maxTeachers, extraTeachers),
    maxClasses: withExtra(plan?.maxClasses, extraClasses),
    storageBytes,
    planSlug,
    addonExtras: {
      students: extraStudents,
      teachers: extraTeachers,
      classes: extraClasses,
      storageGb: extraStorageGb,
    },
  };
}

/** Spazio storage attualmente usato dal tenant (somma dimensione materiali). */
export async function getStorageUsedBytes(tenantId: string): Promise<number> {
  const agg = await prisma.material.aggregate({
    where: { tenantId },
    _sum: { size: true },
  });
  return Number(agg._sum.size ?? 0);
}

export { ADDON_CATALOG };
