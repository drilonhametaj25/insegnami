/**
 * Seed del tenant demo pubblico (slug 'demo').
 *
 * Uso:
 *   npx tsx scripts/seed-demo.ts            # crea/aggiorna (idempotente)
 *   npx tsx scripts/seed-demo.ts --reset    # wipe completo + ri-seed
 *
 * Credenziali: demo@insegnami.pro / env DEMO_PASSWORD
 * (default 'demo1234' SOLO fuori produzione).
 *
 * La logica vive in lib/demo/seed-demo-tenant.ts, riusata anche dal cron
 * 'reset-demo-tenant' (03:00 Europe/Rome) in lib/workers/cron-scheduler.ts.
 */

import { prisma } from '@/lib/db';
import { seedDemoTenant, resetDemoTenant, DEMO_EMAIL } from '@/lib/demo/seed-demo-tenant';

async function main() {
  const reset = process.argv.includes('--reset');
  console.log(reset ? 'Reset + seed del tenant demo...' : 'Seed del tenant demo...');

  const result = reset ? await resetDemoTenant() : await seedDemoTenant();

  console.log('Tenant demo pronto:', result);
  console.log(`Login: ${DEMO_EMAIL} / ${process.env.DEMO_PASSWORD ? '<DEMO_PASSWORD da env>' : 'demo1234 (default dev)'}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Errore nel seed demo:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
