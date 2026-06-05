import { test, expect } from '@playwright/test';
import { login, testApi, SEED_TENANT_SLUG } from './helpers/auth';

/**
 * Wizard di onboarding: dal redirect post-login fino al completamento,
 * con persistenza dei dati della scuola.
 * Serial perché muta lo stato di setup del tenant seed.
 */
test.describe.serial('Onboarding wizard', () => {
  test.afterAll(async ({ request }) => {
    // Ripristina lo stato completo per non disturbare gli altri test
    await testApi(request, { action: 'complete-onboarding', slug: SEED_TENANT_SLUG });
  });

  test('admin con onboarding incompleto viene reindirizzato al wizard', async ({ page, request }) => {
    await testApi(request, { action: 'reset-onboarding', slug: SEED_TENANT_SLUG });
    await login(page, 'admin');
    await page.waitForURL(/onboarding/, { timeout: 20000 });
    await expect(page.getByText('Benvenuto su InsegnaMi.pro')).toBeVisible();
  });

  test('completamento del wizard salva i dati e porta alla dashboard', async ({ page, request }) => {
    await testApi(request, { action: 'reset-onboarding', slug: SEED_TENANT_SLUG });
    await login(page, 'admin');
    await page.waitForURL(/onboarding/, { timeout: 20000 });

    // Step 0 → Inizia
    await page.getByRole('button', { name: 'Inizia Configurazione' }).click();

    // Step 1 — Dettagli scuola
    await expect(page.getByText('Dettagli della Scuola')).toBeVisible();
    await page.getByPlaceholder('es. Scuola di Musica Milano').fill('English Plus Academy');
    await page.getByPlaceholder('Via Roma 1, 20100 Milano').fill('Via Verdi 10, Milano');
    await page.getByPlaceholder('+39 02 1234567').fill('+39 02 9999999');
    await page.getByPlaceholder('info@scuola.it').fill('info@englishplus.it');
    await page.getByRole('button', { name: 'Continua' }).click();

    // Step 2 — Team (salta)
    await expect(page.getByText('Invita il Team')).toBeVisible();
    await page.getByRole('button', { name: 'Salta' }).click();

    // Step 3 — Insegnanti (salta)
    await expect(page.getByText('Aggiungi Insegnanti')).toBeVisible();
    await page.getByRole('button', { name: 'Salta' }).click();

    // Step 4 — Classi → Completa
    await expect(page.getByText('Crea le Classi')).toBeVisible();
    await page.getByRole('button', { name: 'Completa Setup' }).click();

    // Atterraggio in dashboard
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 });

    // Persistenza dati scuola
    const { tenant } = await testApi(request, { action: 'get-tenant', slug: SEED_TENANT_SLUG });
    expect(tenant.name).toBe('English Plus Academy');
    expect(tenant.address).toBe('Via Verdi 10, Milano');
    expect(tenant.phone).toBe('+39 02 9999999');
    expect(tenant.email).toBe('info@englishplus.it');
    expect(tenant.setupStage).toBe('COMPLETE');
  });

  test('admin con onboarding completo va direttamente alla dashboard', async ({ page, request }) => {
    await testApi(request, { action: 'complete-onboarding', slug: SEED_TENANT_SLUG });
    await login(page, 'admin');
    await page.goto('/it/dashboard');
    await expect(page).toHaveURL(/\/dashboard(\/|$)/);
    // Non deve rimbalzare su onboarding
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/onboarding/);
  });
});
