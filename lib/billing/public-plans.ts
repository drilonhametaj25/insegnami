import { prisma } from '@/lib/db';
import { PLAN_CATALOG, yearlyPriceOf } from './plans-catalog';

export interface PublicPlan {
  id: string | null;
  name: string;
  slug: string;
  price: number; // €/mese
  yearlyPrice: number; // €/anno (12 mesi al prezzo di 10)
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
  features: Record<string, boolean>;
  description: string;
  isPopular: boolean;
}

/**
 * Piani per le pagine pubbliche (homepage e /pricing): stessa query server
 * per entrambe, così le due vetrine non possono divergere. Fallback sul
 * catalogo statico quando il DB non è raggiungibile (build, ambienti senza
 * seed): la vetrina non deve mai renderizzare vuota.
 */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        maxStudents: true,
        maxTeachers: true,
        maxClasses: true,
        features: true,
        description: true,
        isPopular: true,
      },
    });

    if (plans.length > 0) {
      return plans.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        yearlyPrice: yearlyPriceOf(Number(p.price)),
        maxStudents: p.maxStudents,
        maxTeachers: p.maxTeachers,
        maxClasses: p.maxClasses,
        features: (p.features as Record<string, boolean>) ?? {},
        description: p.description ?? '',
        isPopular: p.isPopular,
      }));
    }
  } catch {
    // build-time / DB non disponibile → catalogo statico
  }

  return PLAN_CATALOG.map((p) => ({
    id: null,
    name: p.name,
    slug: p.slug,
    price: p.price,
    yearlyPrice: yearlyPriceOf(p.price),
    maxStudents: p.maxStudents,
    maxTeachers: p.maxTeachers,
    maxClasses: p.maxClasses,
    features: p.features,
    description: p.description,
    isPopular: p.isPopular,
  }));
}
