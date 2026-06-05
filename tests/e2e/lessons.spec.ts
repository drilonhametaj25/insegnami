import { test, expect, Page } from '@playwright/test';
import { storageStateFor, resetTestData } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

// Seleziona la prima opzione di un Select Mantine. I Mantine Select tengono
// tutte le opzioni nel DOM: filtriamo solo quelle VISIBILI (del dropdown aperto).
async function selectFirst(page: Page, placeholder: string) {
  await page.getByPlaceholder(placeholder).click();
  await page.locator('[role="option"]:visible').first().click();
}

test.describe('Lezioni — CRUD', () => {
  // Reset dati/limiti: evita conflitti di orario e limiti di piano
  test.beforeEach(async ({ request }) => {
    await resetTestData(request);
  });

  test('crea una nuova lezione', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const title = `Lezione Test ${stamp}`;

    await page.goto('/it/dashboard/lessons');
    await page.getByRole('button', { name: 'Nuova Lezione' }).first().click();

    await page.getByPlaceholder('Es. Introduzione al Present Simple').fill(title);
    // Selezionando la classe, docente e corso si auto-popolano (cascata del form).
    await selectFirst(page, 'Seleziona classe');
    // Fallback: se non auto-popolati, selezionali esplicitamente.
    const submit = page.getByRole('button', { name: 'Crea Lezione' });
    if (!(await submit.isEnabled())) {
      await selectFirst(page, 'Seleziona docente');
      await selectFirst(page, 'Seleziona corso');
    }
    await expect(submit).toBeEnabled();
    await submit.click();

    // Passa alla vista Lista e cerca la lezione appena creata (ricerca server-side)
    await page.getByText('Lista', { exact: true }).click();
    await page.getByPlaceholder('Cerca lezioni...').fill(title);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
  });
});
