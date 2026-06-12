/**
 * Cleanup one-off dei prodotti Stripe legacy ("InsegnaMi - Starter" ecc.,
 * creati prima della sync con metadata): archivia prodotti e relativi prezzi
 * che NON portano metadata.platform = 'InsegnaMi'.
 *
 * I prodotti nuovi della sync (lib/billing/stripe-sync.ts) hanno sempre i
 * metadata di piattaforma e non vengono toccati. L'archiviazione non
 * interrompe gli abbonamenti attivi sui prezzi vecchi, ma il webhook risolve
 * il piano via Plan.stripePriceId (che dopo la sync punta ai prezzi nuovi):
 * eventuali subscription ancora sui prezzi legacy vanno migrate a mano.
 *
 *   npm run stripe:cleanup-legacy           # dry-run: mostra cosa farebbe
 *   npm run stripe:cleanup-legacy -- --apply # esegue davvero
 */
import { stripe, PLATFORM_METADATA } from '../lib/stripe';
import { isStripeEnabled } from '../lib/billing/billing-mode';

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!isStripeEnabled()) {
    console.warn('STRIPE_SECRET_KEY non configurata (o placeholder): niente da pulire.');
    process.exit(0);
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  const legacy = products.data.filter(
    (p) =>
      p.name.startsWith('InsegnaMi') &&
      p.metadata?.platform !== PLATFORM_METADATA.platform
  );

  if (legacy.length === 0) {
    console.log('Nessun prodotto legacy attivo trovato: niente da fare.');
    return;
  }

  console.log(`${APPLY ? 'ARCHIVIO' : 'DRY-RUN (usa --apply per eseguire)'} — ${legacy.length} prodotti legacy:\n`);

  for (const product of legacy) {
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    console.log(`- ${product.name} (${product.id})`);
    for (const price of prices.data) {
      const amount = ((price.unit_amount ?? 0) / 100).toFixed(2);
      console.log(`    prezzo ${price.id}: €${amount}/${price.recurring?.interval ?? 'one-time'}`);
      if (APPLY) {
        await stripe.prices.update(price.id, { active: false });
        console.log('      → archiviato');
      }
    }
    if (APPLY) {
      await stripe.products.update(product.id, { active: false });
      console.log('    → prodotto archiviato');
    }
  }

  if (APPLY) {
    console.log('\nCleanup completato. Verifica su dashboard.stripe.com → Prodotti (filtro "Archiviati").');
  }
}

main().catch((e) => {
  console.error('Cleanup fallito:', e?.message || e);
  process.exit(1);
});
