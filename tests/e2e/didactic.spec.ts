import { test, expect } from '@playwright/test';
import { storageStateFor, resetTestData } from './helpers/auth';
import { selectFirstOption } from './helpers/ui';

test.use({ storageState: storageStateFor('admin') });

test.describe('Materie — CRUD', () => {
  test('crea una nuova materia', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const name = `Materia Test ${stamp}`;
    const code = `MT${stamp}`.slice(0, 10);

    await page.goto('/it/dashboard/subjects');
    await page.getByRole('button', { name: 'Nuova Materia' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nome Materia').fill(name);
    await dialog.getByLabel('Codice').fill(code);
    await dialog.getByRole('button', { name: /Crea|Salva/i }).first().click();

    await expect(dialog).toBeHidden({ timeout: 15000 });
    await page.getByPlaceholder(/Cerca/i).first().fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Avvisi — CRUD', () => {
  test('crea un nuovo avviso', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const title = `Avviso Test ${stamp}`;

    await page.goto('/it/dashboard/notices');
    await page.getByRole('button', { name: 'Nuovo Avviso' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Titolo').fill(title);
    await dialog.getByLabel('Contenuto').fill('Contenuto di test per l\'avviso.');
    await dialog.getByRole('button', { name: /Crea|Pubblica|Salva/i }).first().click();

    await expect(dialog).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Compiti — CRUD', () => {
  test.beforeAll(async ({ request }) => {
    await resetTestData(request);
  });

  test('crea un nuovo compito', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const title = `Compito Test ${stamp}`;

    await page.goto('/it/dashboard/homework');
    await page.getByRole('button', { name: 'Nuovo Compito' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Classe e Materia (Select richiesti)
    await selectFirstOption(page, dialog.getByPlaceholder(/Seleziona classe/i));
    await selectFirstOption(page, dialog.getByPlaceholder(/Seleziona materia/i));
    // Titolo + descrizione
    await dialog.getByPlaceholder(/Esercizi|es\./i).first().fill(title);
    await dialog.getByLabel(/Descrizione/i).fill('Svolgere gli esercizi assegnati.');
    // Date pre-compilate (oggi / +7gg)

    await dialog.getByRole('button', { name: /Crea|Salva/i }).first().click();
    await expect(dialog).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });
  });
});
