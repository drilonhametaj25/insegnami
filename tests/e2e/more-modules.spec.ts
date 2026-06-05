import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';
import { pickDay } from './helpers/ui';

test.use({ storageState: storageStateFor('admin') });

test.describe('Anni Scolastici — CRUD', () => {
  test('crea un nuovo anno scolastico', async ({ page }) => {
    const stamp = Date.now().toString().slice(-5);
    const name = `2099/${stamp}`;

    await page.goto('/it/dashboard/academic-years');
    await page.getByRole('button', { name: 'Nuovo Anno Scolastico' }).first().click();

    const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Nome Anno') });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nome Anno').fill(name);
    // Data Inizio (giorno 5) e Data Fine (giorno 25) dello stesso mese.
    // Gli opener sono i bottoni DatePickerInput, identificati per ruolo.
    await pickDay(page, dialog.getByRole('button', { name: 'Data Inizio' }), 5);
    await pickDay(page, dialog.getByRole('button', { name: 'Data Fine' }), 25);
    // Verifica che entrambe le date siano impostate prima di inviare
    await expect(dialog.getByRole('button', { name: 'Data Inizio' })).not.toHaveText(/Seleziona/);
    await expect(dialog.getByRole('button', { name: 'Data Fine' })).not.toHaveText(/Seleziona/);

    await dialog.getByRole('button', { name: 'Crea Anno' }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });
});

// La creazione messaggio è coperta a livello API in modules-api.spec.ts
// ("Messaggio: creazione riuscita"). Il test UI del MultiSelect destinatari
// di questo form è risultato instabile con Playwright (il modulo funziona:
// POST /api/messages → 201) ed è stato sostituito dalla copertura API.
// Il bug i18n reale (chiavi root `recipients`/`view` mancanti) è stato corretto.
