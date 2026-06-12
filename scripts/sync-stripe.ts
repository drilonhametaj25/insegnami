/**
 * Sync del catalogo commerciale (3 piani + 4 add-on) su Stripe.
 * Idempotente: rieseguibile in sicurezza, crea solo ciò che manca e
 * ruota i prezzi solo se l'importo nel catalogo è cambiato.
 *
 *   npm run sync:stripe
 *   (richiede STRIPE_SECRET_KEY reale nel .env)
 */
import { PrismaClient } from '@prisma/client';
import { isStripeEnabled } from '../lib/billing/billing-mode';
import { syncAllToStripe } from '../lib/billing/stripe-sync';

const prisma = new PrismaClient();

async function main() {
  if (!isStripeEnabled()) {
    // exit(0), NON exit(1): in dev billing (o in un deploy senza chiavi
    // Stripe) la sync è semplicemente superflua e non deve abortire la
    // pipeline (deploy.sh gira con set -e).
    console.warn(
      'STRIPE_SECRET_KEY non configurata (o placeholder): salto la sync Stripe (dev billing).'
    );
    process.exit(0);
  }

  const results = await syncAllToStripe(prisma);
  for (const r of results) {
    const yearly = r.yearlyPriceId ? `, yearly=${r.yearlyPriceId}` : '';
    console.log(
      `✔ [${r.kind}] ${r.key}: ${r.action} (product=${r.productId}, price=${r.priceId}${yearly})`
    );
  }
  console.log(`\nSync completata: ${results.length} elementi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Sync fallita:', e?.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
