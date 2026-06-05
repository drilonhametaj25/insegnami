import { test, expect } from '@playwright/test';
import { login, completeOnboarding, resetBilling, setTrial, testApi, SEED_TENANT_SLUG } from './helpers/auth';

/**
 * Flusso commerciale: trial → sottoscrizione → upgrade/downgrade → add-on.
 * Usa il tenant seed (english-plus) con onboarding completato.
 * Serial: i test condividono lo stato dell'abbonamento del tenant.
 */
test.describe.serial('Flusso commerciale (billing)', () => {
  test.beforeAll(async ({ request }) => {
    await completeOnboarding(request);
    await setTrial(request, SEED_TENANT_SLUG, 14);
    await resetBilling(request);
  });

  test('billing mostra lo stato di prova quando non c\'è abbonamento', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/dashboard/billing');
    await expect(page.getByText('Fatturazione & Abbonamento')).toBeVisible();
    // In trial senza abbonamento: appare l'invito a scegliere un piano
    await expect(page.getByRole('link', { name: /Scegli un Piano/i }).first()).toBeVisible();
  });

  test('sottoscrizione di un piano dalla pagina pricing attiva l\'abbonamento', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/pricing');
    await page.getByTestId('subscribe-starter').click();
    // Dev billing → redirect interno alla pagina di fatturazione
    await page.waitForURL(/\/dashboard\/billing/, { timeout: 20000 });
    // L'abbonamento Starter è ora attivo (o in prova)
    await expect(page.getByText('Starter').first()).toBeVisible();
    await expect(page.getByTestId('plan-change-section')).toBeVisible();
    await expect(page.getByTestId('addons-section')).toBeVisible();
  });

  test('upgrade a Professional aggiorna il piano corrente', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/dashboard/billing');
    await page.getByTestId('plan-change-professional').click();
    // Asserzione sullo stato finale: Professional risulta il piano attuale
    await expect(
      page.getByTestId('plan-option-professional').getByText('Attuale', { exact: true })
    ).toBeVisible({ timeout: 15000 });
  });

  test('downgrade a Starter funziona', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/dashboard/billing');
    await page.getByTestId('plan-change-starter').click();
    await expect(
      page.getByTestId('plan-option-starter').getByText('Attuale', { exact: true })
    ).toBeVisible({ timeout: 15000 });
  });

  test('acquisto add-on posti studente extra aumenta la quantità', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/dashboard/billing');
    await expect(page.getByTestId('addon-EXTRA_STUDENTS-qty')).toHaveText('0');
    await page.getByTestId('addon-EXTRA_STUDENTS-add').click();
    await expect(page.getByTestId('addon-EXTRA_STUDENTS-qty')).toHaveText('1', { timeout: 15000 });
    // Il totale mensile add-on compare
    await expect(page.getByTestId('addons-total')).toBeVisible();
  });

  test('acquisto add-on storage extra e rimozione', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/dashboard/billing');
    await page.getByTestId('addon-EXTRA_STORAGE-add').click();
    await expect(page.getByTestId('addon-EXTRA_STORAGE-qty')).toHaveText('1', { timeout: 15000 });
    await page.getByTestId('addon-EXTRA_STORAGE-remove').click();
    await expect(page.getByTestId('addon-EXTRA_STORAGE-qty')).toHaveText('0', { timeout: 15000 });
  });
});

/**
 * Flusso di registrazione di una nuova scuola (tenant) in modalità SaaS,
 * con verifica email simulata tramite token recuperato dall'endpoint di test.
 */
test.describe.serial('Registrazione nuova scuola', () => {
  const unique = Date.now();
  const email = `preside.test+${unique}@scuolatest.it`;
  const schoolName = `Scuola Test ${unique}`;

  test.beforeAll(async ({ request }) => {
    await testApi(request, { action: 'delete-user-by-email', email });
  });

  test('registrazione → verifica email → onboarding', async ({ page, request }) => {
    await page.goto('/it/auth/register');

    // Compila il form di registrazione (selettori via placeholder)
    await page.getByPlaceholder('Il tuo nome').fill('Mario');
    await page.getByPlaceholder('Il tuo cognome').fill('Bianchi');
    await page.getByPlaceholder('tua.email@esempio.it').fill(email);
    await page.getByPlaceholder('Es: Liceo Scientifico Galilei').fill(schoolName);
    // Ruolo (Mantine Select)
    await page.getByPlaceholder('Seleziona il tuo ruolo').click();
    await page.getByRole('option', { name: 'Amministratore' }).click();
    await page.getByPlaceholder('La tua password').fill('TestPassword1');
    await page.getByPlaceholder('Conferma la password').fill('TestPassword1');
    // Checkbox obbligatorie
    await page.getByLabel('Accetto i termini di servizio').check();
    await page.getByLabel('Accetto la privacy policy').check();

    await page.getByRole('button', { name: 'Crea Account' }).click();

    // Schermata di conferma registrazione
    await expect(page.getByText(/Controlla la tua (email|casella)/i).first())
      .toBeVisible({ timeout: 20000 });

    // Recupera il token di verifica e completa la verifica email
    const { token } = await testApi(request, { action: 'verification-token', email });
    expect(token).toBeTruthy();
    await page.goto(`/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`);

    // Dopo la verifica si può accedere
    await page.goto('/it/auth/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('TestPassword1');
    await page.getByRole('button', { name: 'Accedi' }).click();

    // Nuovo tenant → onboarding
    await page.waitForURL(/onboarding|dashboard/, { timeout: 20000 });
  });
});
