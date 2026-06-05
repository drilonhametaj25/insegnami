/**
 * Seed idempotente dei piani di abbonamento SaaS.
 * Eseguibile in sicurezza più volte: usa upsert per slug.
 *   npx tsx scripts/seed-plans.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_dev',
    price: 29,
    interval: 'MONTHLY' as const,
    maxStudents: 50,
    maxTeachers: 5,
    maxClasses: 10,
    features: {
      attendance: true,
      payments: true,
      communications: true,
      calendar: true,
      reports: true,
      parentPortal: true,
    },
    description: 'Per piccole scuole e centri di formazione',
    isPopular: false,
    sortOrder: 1,
  },
  {
    name: 'Professional',
    slug: 'professional',
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_dev',
    price: 79,
    interval: 'MONTHLY' as const,
    maxStudents: 200,
    maxTeachers: 20,
    maxClasses: 50,
    features: {
      attendance: true,
      payments: true,
      communications: true,
      calendar: true,
      reports: true,
      parentPortal: true,
      analytics: true,
      integrations: true,
      whiteLabel: true,
    },
    description: 'Per scuole in crescita con più sedi',
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_dev',
    price: 199,
    interval: 'MONTHLY' as const,
    maxStudents: null,
    maxTeachers: null,
    maxClasses: null,
    features: {
      attendance: true,
      payments: true,
      communications: true,
      calendar: true,
      reports: true,
      parentPortal: true,
      analytics: true,
      integrations: true,
      whiteLabel: true,
      advancedReporting: true,
      multiCampus: true,
      slaGuarantee: true,
      dedicatedSupport: true,
      customIntegrations: true,
    },
    description: 'Per grandi istituti e franchising',
    isPopular: false,
    sortOrder: 3,
  },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        stripePriceId: plan.stripePriceId,
        price: plan.price,
        interval: plan.interval,
        maxStudents: plan.maxStudents,
        maxTeachers: plan.maxTeachers,
        maxClasses: plan.maxClasses,
        features: plan.features,
        description: plan.description,
        isPopular: plan.isPopular,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: { ...plan, isActive: true },
    });
    console.log(`✔ Plan upserted: ${plan.name} (${plan.slug})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
