import { test as setup, expect } from '@playwright/test';
import { ACCOUNTS, Role, SEED_TENANT_SLUG, SECOND_TENANT_SLUG, AUTH_DIR, storageStateFor } from './helpers/auth';
import fs from 'fs';

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

/**
 * Autentica una volta sola ciascun ruolo e salva lo storage state, così i
 * test riutilizzano la sessione senza ri-loggarsi (evita il rate-limit del
 * login e velocizza la suite). L'onboarding del tenant seed viene completato.
 */
setup('prepara sessioni autenticate', async ({ browser, request }) => {
  // 5 login sequenziali + compilazione pagine in dev: serve più tempo
  setup.setTimeout(150_000);
  // Assicura onboarding completo per non far rimbalzare l'admin sul wizard
  await request.post('/api/test', {
    data: { action: 'complete-onboarding', slug: SEED_TENANT_SLUG },
  });
  // Idem per il secondo tenant (usato dai test di isolamento tenant)
  await request.post('/api/test', {
    data: { action: 'complete-onboarding', slug: SECOND_TENANT_SLUG },
  });

  const roles: Role[] = ['admin', 'teacher', 'student', 'parent', 'admin2'];
  for (const role of roles) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const acct = ACCOUNTS[role];
    await page.goto('/it/auth/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(acct.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(acct.password);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.waitForURL(/\/(it\/)?(dashboard|onboarding)/, { timeout: 30000 });
    await ctx.storageState({ path: storageStateFor(role) });
    await ctx.close();
  }
});
