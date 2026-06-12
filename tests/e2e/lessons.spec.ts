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

test.describe('Lezioni — deep-link searchParams', () => {
  test('?action=create apre il modal di creazione', async ({ page }) => {
    await page.goto('/it/dashboard/lessons?action=create');

    // Il modal di creazione è aperto con il form lezione
    await expect(
      page.getByPlaceholder('Es. Introduzione al Present Simple')
    ).toBeVisible({ timeout: 15000 });
  });

  test('legacy ?createNew=true apre il modal di creazione', async ({ page }) => {
    await page.goto('/it/dashboard/lessons?createNew=true');

    await expect(
      page.getByPlaceholder('Es. Introduzione al Present Simple')
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Lezioni — modifica serie ricorrente', () => {
  test.beforeEach(async ({ request }) => {
    await resetTestData(request);
  });

  test('la modifica di una lezione ricorrente chiede lo scope e aggiorna la serie', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const title = `Serie Test ${stamp}`;
    const newTitle = `${title} Modificata`;

    // 1) Crea una lezione ricorrente settimanale
    await page.goto('/it/dashboard/lessons');
    await page.getByRole('button', { name: 'Nuova Lezione' }).first().click();

    await page.getByPlaceholder('Es. Introduzione al Present Simple').fill(title);
    await selectFirst(page, 'Seleziona classe');
    const submit = page.getByRole('button', { name: 'Crea Lezione' });
    if (!(await submit.isEnabled())) {
      await selectFirst(page, 'Seleziona docente');
      await selectFirst(page, 'Seleziona corso');
    }
    // Attiva la ricorrenza (Switch Mantine)
    await page.getByLabel('Lezione Ricorrente').check({ force: true });
    await expect(submit).toBeEnabled();
    await submit.click();

    // 2) Apri il dettaglio di una occorrenza dalla vista Lista
    await page.getByText('Lista', { exact: true }).click();
    await page.getByPlaceholder('Cerca lezioni...').fill(title);
    const row = page.getByRole('row', { name: new RegExp(title) }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    // Primo ActionIcon della riga = "Visualizza dettagli"
    await row.getByRole('button').first().click();
    await expect(page).toHaveURL(/\/it\/dashboard\/lessons\/[^/?]+$/, { timeout: 15000 });

    // 3) Avvia la modifica dal menu del dettaglio
    await page.locator('button:has(svg.tabler-icon-dots-vertical)').first().click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    // Il form di modifica è precompilato
    const titleInput = page.getByPlaceholder('Es. Introduzione al Present Simple');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(newTitle);
    await page.getByRole('button', { name: 'Aggiorna Lezione' }).click();

    // 4) Essendo una lezione di serie, compare il modal di scelta scope
    await expect(page.getByText('Solo questa lezione')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Tutta la serie')).toBeVisible();
    await expect(page.getByText('Da qui in avanti')).toBeVisible();

    // 5) Applica a tutta la serie
    await page.getByLabel('Tutta la serie').check({ force: true });
    await page.getByRole('button', { name: 'Conferma' }).click();

    // Notifica di successo e titolo aggiornato nel dettaglio
    await expect(page.getByText(/Serie aggiornata/)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: new RegExp(newTitle) }).first()
    ).toBeVisible({ timeout: 15000 });
  });
});
