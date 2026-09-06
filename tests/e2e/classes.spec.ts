import { test, expect, Page } from '@playwright/test';
import { storageStateFor, resetTestData } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

/** Seleziona la prima opzione VISIBILE di un Select Mantine (dropdown aperto). */
async function selectFirst(page: Page, placeholder: string) {
  await page.getByPlaceholder(placeholder).click();
  await page.locator('[role="option"]:visible').first().click();
}

test.describe('Classi — CRUD', () => {
  test.beforeAll(async ({ request }) => {
    await resetTestData(request);
  });

  test('crea una nuova classe e la mostra in lista', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const className = `Classe Test ${stamp}`;

    await page.goto('/it/dashboard/classes');
    await page.getByRole('button', { name: 'Nuova Classe' }).first().click();

    await page.getByPlaceholder('Es. Inglese Principianti A1').fill(className);
    await selectFirst(page, 'Seleziona corso');
    await selectFirst(page, 'Seleziona docente');

    const submit = page.getByRole('button', { name: 'Crea Classe' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // La classe appena creata compare in lista
    await page.getByPlaceholder('Cerca classi...').fill(className);
    await expect(page.getByText(className).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Classi — Nuova Lezione dal dettaglio', () => {
  test('il bottone Nuova Lezione apre il modal lezione con classe preimpostata @smoke', async ({ page }) => {
    await page.goto('/it/dashboard/classes');

    // Apri il dettaglio della prima classe in lista
    const firstClassLink = page.locator('table tbody tr').first().locator('button').first();
    await firstClassLink.click();
    await expect(page).toHaveURL(/\/it\/dashboard\/classes\/[^/?]+$/, { timeout: 15000 });

    // Vai al tab Lezioni e clicca "Nuova Lezione"
    await page.getByRole('tab', { name: /Lezioni/ }).click();
    await page.getByRole('button', { name: 'Nuova Lezione' }).first().click();

    // Redirect alla pagina lezioni con action=create e classId nel query string
    await expect(page).toHaveURL(/\/it\/dashboard\/lessons\?action=create&classId=[^&]+/, {
      timeout: 15000,
    });

    // Il modal di creazione lezione è aperto con la classe preselezionata
    await expect(
      page.getByPlaceholder('Es. Introduzione al Present Simple')
    ).toBeVisible({ timeout: 15000 });
    // Il Select classe è precompilato (input non vuoto)
    await expect(page.getByPlaceholder('Seleziona classe')).not.toBeEmpty();
  });
});
