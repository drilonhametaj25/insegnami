import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

/**
 * Contabilità (C4): movimenti manuali + report P&L.
 * Solo scrittura — la suite gira con lo stack e2e del progetto.
 */
test.describe('Contabilità — movimenti', () => {
  test('registra un movimento manuale di costo', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const description = `Utenze Test ${stamp}`;

    await page.goto('/it/dashboard/accounting');
    await page.getByRole('button', { name: 'Nuovo Movimento' }).click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo Movimento' });
    await expect(dialog).toBeVisible();

    // Tipo: default COST — lasciamo il default
    await dialog.getByLabel('Categoria').fill('utenze');
    await dialog.getByLabel('Importo').fill('250');
    await dialog.getByLabel('Descrizione').fill(description);

    await dialog.getByRole('button', { name: 'Crea', exact: true }).click();

    await expect(page.getByText('Movimento creato con successo').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(dialog).toBeHidden({ timeout: 15000 });

    // Il nuovo movimento appare nella tabella (tab Movimenti attivo di default)
    await expect(page.getByText(description).first()).toBeVisible({ timeout: 15000 });
  });

  test('registra un movimento manuale di ricavo', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const description = `Sponsor Test ${stamp}`;

    await page.goto('/it/dashboard/accounting');
    await page.getByRole('button', { name: 'Nuovo Movimento' }).click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo Movimento' });
    await expect(dialog).toBeVisible();

    // Tipo REVENUE (permesso anche per i movimenti manuali)
    await dialog.getByLabel('Tipo').click();
    await page.locator('[role="option"]', { hasText: 'Ricavo' }).first().click();

    await dialog.getByLabel('Categoria').fill('altro');
    await dialog.getByLabel('Importo').fill('500');
    await dialog.getByLabel('Descrizione').fill(description);

    await dialog.getByRole('button', { name: 'Crea', exact: true }).click();

    await expect(page.getByText('Movimento creato con successo').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(dialog).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(description).first()).toBeVisible({ timeout: 15000 });
  });

  test('filtra i movimenti per tipo', async ({ page }) => {
    await page.goto('/it/dashboard/accounting');

    // Applica il filtro tipo = Costo
    await page.getByLabel('Tipo').click();
    await page.locator('[role="option"]', { hasText: 'Costo' }).first().click();

    // La tabella si aggiorna senza errori e mostra solo badge Costo (se presenti)
    await page.waitForTimeout(1000);
    const revenueBadges = page.locator('table').getByText('Ricavo', { exact: true });
    await expect(revenueBadges).toHaveCount(0);
  });
});

test.describe('Contabilità — P&L', () => {
  test('mostra il report P&L con cards e breakdown', async ({ page }) => {
    await page.goto('/it/dashboard/accounting');
    await page.getByRole('tab', { name: 'P&L' }).click();

    // Cards principali
    await expect(page.getByText('Ricavi', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('Costi', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Risultato Netto').first()).toBeVisible();

    // Breakdown per categoria + trend
    await expect(page.getByText('Ricavi per categoria')).toBeVisible();
    await expect(page.getByText('Costi per categoria')).toBeVisible();
    await expect(page.getByText('Trend ultimi 12 mesi')).toBeVisible();
  });

  test('cambia il periodo del report', async ({ page }) => {
    await page.goto('/it/dashboard/accounting');
    await page.getByRole('tab', { name: 'P&L' }).click();

    await page.getByLabel('Periodo').click();
    await page.locator('[role="option"]', { hasText: 'Anno corrente' }).first().click();

    // Il report si ricarica senza errori fatali
    await expect(page.getByText('Risultato Netto').first()).toBeVisible({ timeout: 15000 });
  });
});
