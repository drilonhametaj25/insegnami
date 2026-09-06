import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

/**
 * Portale famiglia (Wave 2): redirect alle dashboard di ruolo e pagine
 * /dashboard/my/* per STUDENT e PARENT. Selettori stabili (data-testid,
 * heading), nessun conteggio assoluto dal seed.
 */

const NO_PERMESSI = 'Non hai i permessi';

test.describe('Portale famiglia — STUDENT', () => {
  test.use({ storageState: storageStateFor('student') });

  test('/dashboard reindirizza alla dashboard studente @smoke', async ({ page }) => {
    await page.goto('/it/dashboard');
    await page.waitForURL(/\/it\/dashboard\/student/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/it\/dashboard\/student/);
  });

  test('le mie valutazioni renderizzano senza errori di permesso', async ({ page }) => {
    await page.goto('/it/dashboard/my/grades');
    await expect(page.getByRole('heading', { name: 'Le mie valutazioni' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(NO_PERMESSI);
  });

  test('i compiti mostrano la lista e la modale di consegna', async ({ page }) => {
    await page.goto('/it/dashboard/my/homework');
    await expect(page.getByRole('heading', { name: 'Compiti', exact: true })).toBeVisible();

    // Il seed pubblica compiti per la classe dello studente
    const openButtons = page.getByTestId('my-homework-open');
    await expect(openButtons.first()).toBeVisible();

    // Apre i primi compiti finché ne trova uno consegnabile (non ancora
    // valutato): nella modale deve comparire il bottone Consegna/Aggiorna.
    const total = Math.min(await openButtons.count(), 3);
    let submittableFound = false;
    for (let i = 0; i < total && !submittableFound; i++) {
      await openButtons.nth(i).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Dettaglio compito')).toBeVisible();
      submittableFound = await page
        .getByTestId('my-homework-submit')
        .waitFor({ state: 'visible', timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      if (!submittableFound) {
        // Compito già valutato: chiudi la modale e prova il successivo
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      }
    }
    expect(
      submittableFound,
      'nessun compito consegnabile trovato tra i primi compiti del seed'
    ).toBeTruthy();
  });

  test('presenze e pagamenti renderizzano', async ({ page }) => {
    await page.goto('/it/dashboard/my/attendance');
    await expect(page.getByRole('heading', { name: 'Presenze', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(NO_PERMESSI);

    await page.goto('/it/dashboard/my/payments');
    await expect(page.getByRole('heading', { name: 'Pagamenti', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(NO_PERMESSI);
  });
});

test.describe('Portale famiglia — PARENT', () => {
  test.use({ storageState: storageStateFor('parent') });

  test('/dashboard reindirizza alla dashboard genitore con entrambi i figli @smoke', async ({ page }) => {
    await page.goto('/it/dashboard');
    await page.waitForURL(/\/it\/dashboard\/parent/, { timeout: 30000 });
    // Entrambi i figli collegati via StudentGuardian sono visibili
    await expect(page.locator('body')).toContainText('Marco');
    await expect(page.locator('body')).toContainText('Sara');
  });

  test('le pagelle renderizzano', async ({ page }) => {
    await page.goto('/it/dashboard/my/report-cards');
    await expect(page.getByRole('heading', { name: 'Pagelle' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(NO_PERMESSI);
  });

  test('il selettore figlio è presente sulle pagine my', async ({ page }) => {
    await page.goto('/it/dashboard/my/grades');
    await expect(page.getByRole('heading', { name: 'Le mie valutazioni' })).toBeVisible();
    // Con più figli il selettore figlio deve comparire
    await expect(page.getByTestId('my-child-select')).toBeVisible();
  });

  test('colloqui: la modale Richiedi colloquio ha docenti selezionabili', async ({ page }) => {
    await page.goto('/it/dashboard/my/meetings');
    await expect(page.getByRole('heading', { name: 'Colloqui' })).toBeVisible();

    await page.getByTestId('my-meetings-request').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Richiedi colloquio')).toBeVisible();

    // Il select docente esiste e NON è vuoto (docenti delle classi dei figli)
    const teacherSelect = dialog.getByLabel('Seleziona Docente');
    await expect(teacherSelect).toBeVisible();
    await teacherSelect.click();
    await expect(page.getByRole('option').first()).toBeVisible();
  });

  test('le note disciplinari renderizzano', async ({ page }) => {
    await page.goto('/it/dashboard/my/notes');
    await expect(page.getByRole('heading', { name: 'Note disciplinari' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(NO_PERMESSI);
  });
});
