import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

test.use({ storageState: storageStateFor('admin') });

// La creazione MESSAGGIO è coperta a livello API in modules-api.spec.ts
// ("Messaggio: creazione riuscita"); qui copriamo i form di template e gruppi.
test.describe('Comunicazione — template e gruppi', () => {
  test('crea un nuovo template di messaggio', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const name = `Template E2E ${stamp}`;

    await page.goto('/it/dashboard/communication');
    await page.getByRole('button', { name: 'Nuovo Template' }).first().click();

    const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Oggetto') });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Nome', { exact: true }).fill(name);
    await dialog.getByLabel('Descrizione').fill('Template creato dal test e2e');
    await dialog.getByLabel('Oggetto').fill(`Oggetto e2e ${stamp}`);
    await dialog.getByLabel('Contenuto').fill('Ciao {{nome}}, questo è un template di prova.');

    await dialog.getByRole('button', { name: 'Crea Template' }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });

    // Il template appare nella tab Template dopo l'invalidazione della query
    await page.getByRole('tab', { name: 'Template Messaggi' }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });

  test('valida i campi obbligatori del template', async ({ page }) => {
    await page.goto('/it/dashboard/communication');
    await page.getByRole('button', { name: 'Nuovo Template' }).first().click();

    const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Oggetto') });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Crea Template' }).click();
    await expect(dialog.getByText('Nome richiesto')).toBeVisible();
    await expect(dialog.getByText('Oggetto richiesto')).toBeVisible();
    await expect(dialog.getByText('Contenuto richiesto')).toBeVisible();
    // Il modal resta aperto: nessuna chiamata POST è partita
    await expect(dialog).toBeVisible();
  });

  test('crea un nuovo gruppo di comunicazione con membri', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const name = `Gruppo E2E ${stamp}`;

    await page.goto('/it/dashboard/communication');
    await page.getByRole('button', { name: 'Nuovo Gruppo' }).first().click();

    const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Membri') });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Nome', { exact: true }).fill(name);
    await dialog.getByLabel('Descrizione').fill('Gruppo creato dal test e2e');

    // Seleziona il primo membro disponibile dalla MultiSelect
    await dialog.getByLabel('Membri').click();
    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();
    // Chiudi la dropdown per non coprire il bottone di submit
    await page.keyboard.press('Escape');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/messages/groups') && res.request().method() === 'POST'
      ),
      dialog.getByRole('button', { name: 'Crea Gruppo' }).click(),
    ]);
    expect(response.status()).toBe(201);

    await expect(dialog).toBeHidden({ timeout: 15000 });
  });

  test('valida i campi obbligatori del gruppo', async ({ page }) => {
    await page.goto('/it/dashboard/communication');
    await page.getByRole('button', { name: 'Nuovo Gruppo' }).first().click();

    const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Membri') });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Crea Gruppo' }).click();
    await expect(dialog.getByText('Il nome deve avere almeno 2 caratteri')).toBeVisible();
    await expect(dialog.getByText('Seleziona almeno un membro')).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});
