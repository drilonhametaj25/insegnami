/**
 * Catalogo dei piani di abbonamento SaaS: unica fonte di verità per
 * seed (scripts/seed-plans.ts) e sync Stripe (lib/billing/stripe-sync.ts).
 * Gli ID Stripe NON vivono qui: vengono creati/verificati dalla sync e
 * persistiti su Plan.stripePriceId.
 */

/**
 * Prezzo annuale = 12 mesi al prezzo di 10 (2 mesi gratis, ~ -17%).
 * Unica definizione della regola: usata da sync Stripe e UI pricing.
 */
export const YEARLY_PRICE_MULTIPLIER = 10;

export function yearlyPriceOf(monthlyPrice: number): number {
  return monthlyPrice * YEARLY_PRICE_MULTIPLIER;
}

export interface PlanDefinition {
  name: string;
  slug: string;
  price: number; // €/mese (l'annuale è derivato: yearlyPriceOf)
  interval: 'MONTHLY' | 'YEARLY';
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
  features: Record<string, boolean>;
  description: string;
  isPopular: boolean;
  sortOrder: number;
}

/**
 * Feature flag ONESTI: ogni chiave qui è davvero applicata dal gating
 * (lib/billing/features.ts + requireAuth({feature})). Le funzionalità core
 * (registro, presenze, voti, pagelle, comunicazioni email, portale famiglia,
 * pagamenti manuali) sono incluse in TUTTI i piani e non hanno flag: il
 * differenziale del piano base sono i limiti numerici.
 */
export const PLAN_CATALOG: PlanDefinition[] = [
  {
    name: 'Starter',
    slug: 'starter',
    price: 29,
    interval: 'MONTHLY',
    maxStudents: 50,
    maxTeachers: 5,
    maxClasses: 10,
    features: {
      paymentReminders: true,
    },
    description: 'Per piccole scuole e centri di formazione',
    isPopular: false,
    sortOrder: 1,
  },
  {
    name: 'Professional',
    slug: 'professional',
    price: 79,
    interval: 'MONTHLY',
    maxStudents: 200,
    maxTeachers: 20,
    maxClasses: 50,
    features: {
      paymentReminders: true,
      einvoicing: true,
      payroll: true,
      accounting: true,
      hoursPackages: true,
      analytics: true,
      scheduleGenerator: true,
      bulkImport: true,
      absenceJustifications: true,
    },
    description: 'Per scuole in crescita con più sedi',
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 199,
    interval: 'MONTHLY',
    maxStudents: null,
    maxTeachers: null,
    maxClasses: null,
    features: {
      paymentReminders: true,
      einvoicing: true,
      payroll: true,
      accounting: true,
      hoursPackages: true,
      analytics: true,
      scheduleGenerator: true,
      bulkImport: true,
      absenceJustifications: true,
      automationsConfig: true,
      whiteLabel: true,
      auditTrail: true,
    },
    description: 'Per grandi istituti e franchising',
    isPopular: false,
    sortOrder: 3,
  },
];
