import { test, expect } from '@playwright/test';
import { login, completeOnboarding, resetBilling, setTrial, testApi, SEED_TENANT_SLUG } from './helpers/auth';

/**
 * Flusso commerciale: trial → sottoscrizione → upgrade/downgrade → add-on.
 * Usa il tenant seed (english-plus) con onboarding completato.
 * Serial: i test condividono lo stato dell'abbonamento del tenant.
 */
test.describe.serial('Flusso commerciale (billing)', () => {
  // Docenti creati dai test di validazione limiti (ripuliti in afterAll)
  const TEACHER_PREFIX = 'TestDocLimite';
  const TEACHERS_TO_CREATE = 6; // seed ha ~1 docente → totale > 5 (limite Starter)

  test.beforeAll(async ({ request }) => {
    await completeOnboarding(request);
    await setTrial(request, SEED_TENANT_SLUG, 14);
    await resetBilling(request);
    await testApi(request, {
      action: 'delete-teachers-by-prefix',
      slug: SEED_TENANT_SLUG,
      prefix: TEACHER_PREFIX,
    });
  });

  test.afterAll(async ({ request }) => {
    await testApi(request, {
      action: 'delete-teachers-by-prefix',
      slug: SEED_TENANT_SLUG,
      prefix: TEACHER_PREFIX,
    });
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

  // ── Validazione limiti su downgrade e add-on ─────────────────────────────
  // Il downgrade è bloccato (409 + bottone disabilitato) se l'uso attivo
  // eccede i limiti del piano target; un add-on che alza il limite lo
  // sblocca; la rimozione di un add-on necessario a coprire l'uso è bloccata.
  // Stato di partenza (dai test precedenti): piano Starter, EXTRA_STUDENTS=1.

  test('downgrade bloccato quando i docenti attivi superano il limite del piano target', async ({ page }) => {
    await login(page, 'admin');

    // Passa a Professional (20 docenti) e crea docenti oltre il limite Starter (5)
    await page.goto('/it/dashboard/billing');
    await page.getByTestId('plan-change-professional').click();
    await expect(
      page.getByTestId('plan-option-professional').getByText('Attuale', { exact: true })
    ).toBeVisible({ timeout: 15000 });

    for (let i = 0; i < TEACHERS_TO_CREATE; i++) {
      const res = await page.request.post('/api/teachers', {
        data: {
          firstName: TEACHER_PREFIX,
          lastName: `Numero${i}`,
          email: `testdoclimite${i}+${Date.now()}@scuolatest.it`,
        },
      });
      expect(res.ok()).toBeTruthy();
    }

    // API: il cambio piano verso Starter risponde 409 con le violazioni
    const change = await page.request.post('/api/subscriptions/change-plan', {
      data: { targetPlanSlug: 'starter' },
    });
    expect(change.status()).toBe(409);
    const body = await change.json();
    expect(body.code).toBe('LIMITS_EXCEEDED');
    expect(body.violations.some((v: any) => v.resource === 'teachers')).toBeTruthy();

    // UI: bottone disabilitato + motivo visibile
    await page.goto('/it/dashboard/billing');
    await expect(page.getByTestId('plan-change-starter')).toBeDisabled();
    await expect(page.getByTestId('plan-change-blocked-starter')).toBeVisible();
  });

  test('acquisto add-on docenti extra sblocca il downgrade', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/it/dashboard/billing');

    // +5 posti docente → limite Starter effettivo 10 ≥ docenti attivi
    await page.getByTestId('addon-EXTRA_TEACHERS-add').click();
    await expect(page.getByTestId('addon-EXTRA_TEACHERS-qty')).toHaveText('1', { timeout: 15000 });

    // L'eligibility si aggiorna e il downgrade ora riesce
    await expect(page.getByTestId('plan-change-starter')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('plan-change-starter').click();
    await expect(
      page.getByTestId('plan-option-starter').getByText('Attuale', { exact: true })
    ).toBeVisible({ timeout: 15000 });
  });

  test('rimozione add-on bloccata se il limite scenderebbe sotto l\'uso attivo', async ({ page }) => {
    await login(page, 'admin');

    // API: rimozione rifiutata con 409
    const removal = await page.request.delete('/api/subscriptions/addons', {
      data: { type: 'EXTRA_TEACHERS', quantity: 1 },
    });
    expect(removal.status()).toBe(409);
    const body = await removal.json();
    expect(body.code).toBe('LIMITS_EXCEEDED');

    // UI: il click mostra l'errore e la quantità resta invariata
    await page.goto('/it/dashboard/billing');
    await expect(page.getByTestId('addon-EXTRA_TEACHERS-qty')).toHaveText('1');
    await page.getByTestId('addon-EXTRA_TEACHERS-remove').click();
    await expect(
      page.getByText(/Non puoi rimuovere questo add-on/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('addon-EXTRA_TEACHERS-qty')).toHaveText('1');
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
    // Run ripetuti della suite esauriscono le 5 registrazioni/ora per IP
    await testApi(request, { action: 'clear-rate-limits' });
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
