import { test, expect, Page } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

async function selectFirst(scope: Page, placeholder: string) {
  await scope.getByPlaceholder(placeholder).click();
  await scope.getByRole('option').first().click();
}

test.describe('Pagamenti — CRUD', () => {
  test('registra un nuovo pagamento', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const description = `Quota Test ${stamp}`;

    await page.goto('/it/dashboard/payments');
    await page.getByRole('button', { name: 'Nuovo Pagamento' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo Pagamento' });
    await expect(dialog).toBeVisible();

    // Studente (Select searchable) — prima opzione visibile del dropdown aperto
    await dialog.getByPlaceholder('Seleziona studente').click();
    await page.locator('[role="option"]:visible').first().click();

    await dialog.getByLabel('Importo').fill('150');
    await dialog.getByLabel('Descrizione').fill(description);

    await dialog.getByRole('button', { name: 'Crea', exact: true }).click();

    // Notifica di successo (la chiusura del dialog conferma la creazione)
    await expect(page.getByText('Pagamento creato con successo').first()).toBeVisible({ timeout: 15000 });
    await expect(dialog).toBeHidden({ timeout: 15000 });
  });
});
