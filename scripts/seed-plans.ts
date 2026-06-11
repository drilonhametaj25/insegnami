/**
 * Seed idempotente dei piani di abbonamento SaaS.
 * Eseguibile in sicurezza più volte: usa upsert per slug.
 *   npx tsx scripts/seed-plans.ts
 *
 * Il catalogo vive in lib/billing/plans-catalog.ts. Gli ID prezzo Stripe
 * reali vengono creati/aggiornati da `npm run sync:stripe`; questo seed
 * imposta stripePriceId solo alla creazione (da env o placeholder) e NON
 * sovrascrive mai un priceId già sincronizzato, a meno che l'env var
 * corrispondente sia esplicitamente valorizzata.
 */
import { PrismaClient } from '@prisma/client';
import { PLAN_CATALOG } from '../lib/billing/plans-catalog';

const prisma = new PrismaClient();

const ENV_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
};

async function main() {
  for (const plan of PLAN_CATALOG) {
    const envPriceId = ENV_PRICE_IDS[plan.slug];
    const baseData = {
      name: plan.name,
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
    };

    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        ...baseData,
        // non clobberare un priceId sincronizzato con un placeholder
        ...(envPriceId ? { stripePriceId: envPriceId } : {}),
      },
      create: {
        ...baseData,
        slug: plan.slug,
        stripePriceId: envPriceId || `price_${plan.slug}_dev`,
      },
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
