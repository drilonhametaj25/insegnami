import { test, expect } from '@playwright/test';
import { storageStateFor, completeOnboarding } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

/**
 * Fatturazione elettronica (C2) — flusso completo:
 * impostazioni fiscali → sezionale → bozza con 2 righe (cliente creato
 * inline) → emissione con numero progressivo → PDF scaricabile.
 *
 * Serial: i test condividono il sezionale creato e l'id della fattura.
 * P.IVA usata: 01234567897 (checksum valido per la validazione server).
 */
test.describe.serial('Fatturazione elettronica', () => {
  const stamp = Date.now().toString().slice(-8);
  const seriesCode = `E2E${stamp}`;
  const customerName = `Cliente E2E ${stamp} SRL`;
  let invoiceId = '';

  test.beforeAll(async ({ request }) => {
    await completeOnboarding(request);
  });

  test('salva le impostazioni di fatturazione (identità fiscale)', async ({ page }) => {
    await page.goto('/it/dashboard/invoices/settings');
    await expect(page.getByRole('heading', { name: 'Impostazioni fatturazione' })).toBeVisible();

    await page.getByLabel('Denominazione').fill('Scuola E2E SRL');
    await page.getByLabel('Partita IVA').fill('01234567897');
    await page.getByLabel('Codice fiscale').fill('01234567897');
    await page.getByLabel('Indirizzo').fill('Via Roma 1');
    await page.getByLabel('CAP').fill('20100');
    await page.getByLabel('Comune').fill('Milano');
    await page.getByLabel('Provincia').fill('MI');

    await page.getByRole('button', { name: 'Salva impostazioni' }).click();
    await expect(page.getByText('Impostazioni di fatturazione salvate').first())
      .toBeVisible({ timeout: 15000 });
  });

  test('crea un nuovo sezionale', async ({ page }) => {
    await page.goto('/it/dashboard/invoices/settings');
    await page.getByRole('button', { name: 'Nuovo sezionale' }).click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo sezionale' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Codice').fill(seriesCode);
    await dialog.getByLabel('Descrizione').fill('Sezionale test e2e');
    await dialog.getByRole('button', { name: 'Crea sezionale' }).click();

    await expect(page.getByText('Sezionale creato').first()).toBeVisible({ timeout: 15000 });
    await expect(dialog).toBeHidden({ timeout: 15000 });
    // Il nuovo sezionale compare nella tabella
    await expect(page.getByRole('cell', { name: seriesCode })).toBeVisible();
  });

  test('crea una bozza con 2 righe e cliente creato inline', async ({ page }) => {
    await page.goto('/it/dashboard/invoices/new');
    await expect(page.getByRole('heading', { name: 'Nuova fattura' })).toBeVisible();

    // Seleziona il sezionale creato nel test precedente (getByRole evita la
    // listbox del Select montata hidden, che fa scattare lo strict mode)
    await page.getByRole('textbox', { name: 'Sezionale' }).click();
    await page.getByRole('option', { name: seriesCode }).click();

    // Crea l'anagrafica cliente inline
    await page.getByRole('button', { name: 'Nuovo cliente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova anagrafica cliente' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Denominazione / Ragione sociale').fill(customerName);
    await dialog.getByLabel('Partita IVA').fill('01234567897');
    await dialog.getByLabel('PEC').fill('cliente.e2e@pec.it');
    await dialog.getByLabel('Indirizzo').fill('Via Verdi 10');
    await dialog.getByLabel('CAP').fill('20100');
    await dialog.getByLabel('Comune').fill('Milano');
    await dialog.getByLabel('Provincia').fill('MI');
    await dialog.getByRole('button', { name: 'Salva cliente' }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });

    // Prima riga
    await page.getByLabel('Descrizione').nth(0).fill('Quota corso inglese B1');
    await page.getByLabel('Prezzo unitario').nth(0).fill('100');

    // Seconda riga
    await page.getByRole('button', { name: 'Aggiungi riga' }).click();
    await page.getByLabel('Descrizione').nth(1).fill('Materiale didattico');
    await page.getByLabel('Quantità').nth(1).fill('2');
    await page.getByLabel('Prezzo unitario').nth(1).fill('25');

    // Anteprima totali = computeInvoiceTotals = valori che salverà il server:
    // 100 + 50 = 150 imponibile; IVA 22% = 33; totale 183
    await expect(page.getByTestId('totals-subtotal')).toHaveText('€150,00');
    await expect(page.getByTestId('totals-vat')).toHaveText('€33,00');
    await expect(page.getByTestId('totals-total')).toHaveText('€183,00');

    await page.getByRole('button', { name: 'Crea fattura' }).click();

    // Redirect al dettaglio della bozza appena creata (timeout largo: la
    // navigazione in dev sotto carico può superare i 20s)
    await page.waitForURL(/\/dashboard\/invoices\/c[a-z0-9]{15,}/, { timeout: 45000 });
    invoiceId = page.url().split('/').pop()!;
    expect(invoiceId).toBeTruthy();

    await expect(page.getByText('Bozza', { exact: true }).first()).toBeVisible();
    // Totale fattura coincide con l'anteprima
    await expect(page.getByText('€183,00').first()).toBeVisible();
  });

  test('emissione: assegna il numero progressivo', async ({ page }) => {
    await page.goto(`/it/dashboard/invoices/${invoiceId}`);
    await page.getByRole('button', { name: 'Emetti' }).click();

    await expect(page.getByText('Fattura emessa').first()).toBeVisible({ timeout: 15000 });
    // Badge di stato aggiornato e numero nel titolo (anno/numero a 4 cifre)
    await expect(page.getByText('Emessa', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /\d{4}\/\d{4}/ })).toBeVisible();
  });

  test('il PDF della fattura emessa risponde 200', async ({ page }) => {
    const response = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(0);
  });
});
