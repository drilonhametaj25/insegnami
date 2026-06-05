import { test, expect } from '@playwright/test';
import { storageStateFor, resetTestData } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

test.describe('Docenti — CRUD', () => {
  test.beforeAll(async ({ request }) => {
    await resetTestData(request);
  });

  test('crea un nuovo docente', async ({ page }) => {
    const uniq = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const firstName = `TestDoc${uniq}`;
    const email = `doc${uniq}@scuolatest.it`;

    await page.goto('/it/dashboard/teachers');
    await page.getByRole('button', { name: 'Nuovo Docente' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo Docente' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(firstName);
    await dialog.getByRole('textbox', { name: 'Cognome', exact: true }).fill('Neri');
    await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill(email);

    const submit = dialog.getByRole('button', { name: 'Crea Docente' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Notifica di successo + chiusura del dialog confermano la creazione
    await expect(page.getByText(/Docente creato con successo/i).first()).toBeVisible({ timeout: 15000 });
    await expect(dialog).toBeHidden({ timeout: 15000 });

    // Ricerca server-side: il docente compare in lista
    await page.getByPlaceholder(/Cerca per nome/i).fill(firstName);
    await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 10000 });
  });
});
