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
