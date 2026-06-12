import { test, expect, Page } from '@playwright/test';
import { storageStateFor, testApi, SEED_TENANT_SLUG } from './helpers/auth';

/**
 * E2E C3 — Payroll docenti: flusso completo
 *
 * crea periodo corrente → genera → cedolini>0 → apri dettaglio →
 * imposta ritenuta dal docente → rigenera (delete bozza + genera) →
 * withholding presente → approva → segna pagato.
 */

test.use({ storageState: storageStateFor('admin') });

const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const now = new Date();
const year = now.getFullYear();
const monthLabel = MONTH_LABELS[now.getMonth()];
const periodLabel = `${monthLabel} ${year}`;

/**
 * Espande il periodo corrente finché i link Dettaglio non sono visibili.
 * Dopo "Genera cedolini" la riga si auto-espande ma il refetch può arrivare
 * dopo: un singolo toggle rischia di RICHIUDERE il pannello ancora vuoto,
 * quindi si ritenta l'apertura finché i link non compaiono.
 */
async function ensurePeriodExpanded(page: Page) {
  const detailLink = page.getByRole('link', { name: 'Dettaglio' }).first();
  await expect(async () => {
    if (await detailLink.isVisible()) return;
    await page.getByLabel(`Espandi periodo ${periodLabel}`).click();
    await expect(detailLink).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
}

test.describe.serial('Payroll — flusso completo', () => {
  test.beforeAll(async ({ request }) => {
    // I cedolini PAID delle run precedenti non sono rigenerabili: si riparte puliti
    await testApi(request, { action: 'reset-payroll', slug: SEED_TENANT_SLUG });
  });

  test('crea periodo, genera cedolini, ritenuta docente, rigenera, approva e paga', async ({ page }) => {
    // Flusso lungo su molte pagine: in dev ognuna compila al primo accesso
    test.setTimeout(180_000);
    // Le conferme distruttive usano confirm(): accettiamo tutti i dialog nativi
    page.on('dialog', (dialog) => dialog.accept());

    // -----------------------------------------------------------------
    // 1. Crea (idempotente) il periodo corrente
    // -----------------------------------------------------------------
    await page.goto('/it/dashboard/payroll');
    await page.getByRole('button', { name: 'Nuovo Periodo' }).click();

    const createDialog = page.getByRole('dialog', { name: 'Nuovo Periodo Paghe' });
    await expect(createDialog).toBeVisible();

    await createDialog.getByLabel('Anno').fill(String(year));
    await createDialog.getByLabel('Mese').click();
    await page.locator('[role="option"]:visible', { hasText: monthLabel }).first().click();
    await createDialog.getByRole('button', { name: 'Crea', exact: true }).click();

    await expect(page.getByText('Periodo creato con successo').first()).toBeVisible({ timeout: 15000 });
    await expect(createDialog).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(periodLabel).first()).toBeVisible();

    // -----------------------------------------------------------------
    // 2. Genera i cedolini del periodo → almeno un cedolino in espansione
    // -----------------------------------------------------------------
    await page.getByLabel(`Genera cedolini ${periodLabel}`).click();
    await expect(page.getByText('Cedolini generati').first()).toBeVisible({ timeout: 20000 });

    await ensurePeriodExpanded(page);
    const detailLinks = page.getByRole('link', { name: 'Dettaglio' });
    expect(await detailLinks.count()).toBeGreaterThan(0);

    // -----------------------------------------------------------------
    // 3. Apri il dettaglio del primo cedolino e ricava il docente
    // -----------------------------------------------------------------
    // Nome docente dalla prima cella della riga del cedolino. .last(): il
    // filtro has matcha anche la riga-periodo espansa che contiene la tabella
    // annidata; le righe interne dei cedolini vengono dopo nel DOM.
    const firstPayrollRow = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: 'Dettaglio' }) })
      .last();
    const teacherName = (await firstPayrollRow.locator('td').first().innerText()).trim();
    expect(teacherName.length).toBeGreaterThan(0);

    // Clicca il Dettaglio DELLA STESSA riga da cui abbiamo letto il docente
    await firstPayrollRow.getByRole('link', { name: 'Dettaglio' }).click();
    await page.waitForURL(/\/dashboard\/payroll\/[^/]+$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: new RegExp(`Cedolino ${periodLabel}`) })).toBeVisible();
    await expect(page.getByText(teacherName).first()).toBeVisible();

    // -----------------------------------------------------------------
    // 4. Imposta una ritenuta di default dal tab Compensi del docente
    // -----------------------------------------------------------------
    const [firstName] = teacherName.split(' ');
    await page.goto('/it/dashboard/teachers');
    await page.getByPlaceholder(/Cerca per nome/i).fill(firstName);
    await page.getByText(teacherName).first().click();
    await page.waitForURL(/\/dashboard\/teachers\/[^/]+$/, { timeout: 15000 });

    await page.getByRole('tab', { name: 'Compensi' }).click();
    await expect(page.getByText('Impostazioni Compensi')).toBeVisible();

    await page.getByRole('button', { name: 'Aggiungi ritenuta' }).click();
    // Riga ritenuta con default Ritenuta d'acconto 20%: salviamo direttamente
    await page.getByRole('button', { name: 'Salva impostazioni' }).click();
    await expect(page.getByText('Impostazioni compensi salvate').first()).toBeVisible({ timeout: 15000 });

    // -----------------------------------------------------------------
    // 5. Rigenera: elimina la bozza e genera di nuovo il periodo
    // -----------------------------------------------------------------
    await page.goto('/it/dashboard/payroll');
    await ensurePeriodExpanded(page);

    // Apri il cedolino del docente su cui abbiamo impostato la ritenuta
    // (.last(): la riga esterna del periodo contiene tutta la tabella annidata)
    const teacherRow = page.getByRole('row', { name: new RegExp(teacherName) }).last();
    await teacherRow.getByRole('link', { name: 'Dettaglio' }).click();
    await page.waitForURL(/\/dashboard\/payroll\/[^/]+$/, { timeout: 15000 });

    await page.getByRole('button', { name: 'Elimina bozza' }).click();
    await expect(page.getByText('Bozza eliminata').first()).toBeVisible({ timeout: 15000 });
    await page.waitForURL(/\/dashboard\/payroll$/, { timeout: 15000 });

    await page.getByLabel(`Genera cedolini ${periodLabel}`).click();
    await expect(page.getByText('Cedolini generati').first()).toBeVisible({ timeout: 20000 });

    // -----------------------------------------------------------------
    // 6. La ritenuta è presente nel cedolino rigenerato
    // -----------------------------------------------------------------
    await ensurePeriodExpanded(page);
    const regeneratedRow = page.getByRole('row', { name: new RegExp(teacherName) }).last();
    await regeneratedRow.getByRole('link', { name: 'Dettaglio' }).click();
    await page.waitForURL(/\/dashboard\/payroll\/[^/]+$/, { timeout: 15000 });

    await expect(page.getByRole('heading', { name: 'Ritenute' })).toBeVisible();
    await expect(page.getByText(/Ritenuta d'acconto/i).first()).toBeVisible();

    // -----------------------------------------------------------------
    // 7. Approva → Segna pagato
    // -----------------------------------------------------------------
    await page.getByRole('button', { name: 'Approva' }).click();
    await expect(page.getByText('Cedolino approvato').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Approvato').first()).toBeVisible();

    await page.getByRole('button', { name: 'Segna pagato' }).click();
    const paidDialog = page.getByRole('dialog', { name: 'Segna cedolino come pagato' });
    await expect(paidDialog).toBeVisible();
    await paidDialog.getByLabel('Riferimento pagamento').fill('Bonifico test E2E');
    await paidDialog.getByRole('button', { name: 'Conferma pagamento' }).click();

    await expect(page.getByText('Cedolino segnato come pagato').first()).toBeVisible({ timeout: 15000 });
    await expect(paidDialog).toBeHidden({ timeout: 15000 });
    await expect(page.getByText('Pagato', { exact: true }).first()).toBeVisible();
  });
});
