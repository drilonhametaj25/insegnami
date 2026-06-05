import { test, expect } from '@playwright/test';
import { storageStateFor, resetTestData } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

test.describe('Studenti — CRUD', () => {
  test.beforeAll(async ({ request }) => {
    await resetTestData(request);
  });

  test('crea un nuovo studente e lo mostra in lista', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const firstName = `TestStud${stamp}`;
    const lastName = 'Verdi';

    await page.goto('/it/dashboard/students');
    await page.getByRole('button', { name: 'Nuovo Studente' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo Studente' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(firstName);
    await dialog.getByRole('textbox', { name: 'Cognome', exact: true }).fill(lastName);

    const submit = dialog.getByRole('button', { name: 'Crea Studente' });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    const search = page.getByPlaceholder(/Cerca per nome/i);
    await search.fill(firstName);
    await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 10000 });
  });

  test('apre la pagina di dettaglio di uno studente', async ({ page }) => {
    await page.goto('/it/dashboard/students');
    // Cerca uno studente seed noto per un test deterministico
    await page.getByPlaceholder(/Cerca per nome/i).fill('Bianchi');
    // Attende che la riga sia caricata e stabile prima di interagire
    const row = page.getByRole('row', { name: /Bianchi/i }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByRole('button', { name: 'Dettagli' })).toBeVisible();
    await row.getByRole('button', { name: 'Dettagli' }).click();
    await page.waitForURL(/\/dashboard\/students\/[^/]+$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Profilo Studente' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Informazioni Personali')).toBeVisible();
  });
});
