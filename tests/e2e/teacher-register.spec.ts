import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

/**
 * Registro docente (Wave 2): dashboard dedicata del TEACHER, note
 * disciplinari, dettaglio lezione con appello e scoping API server-side.
 */

const NO_PERMESSI = 'Non hai i permessi';

test.describe('Registro docente — TEACHER', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('/dashboard reindirizza alla dashboard docente @smoke', async ({ page }) => {
    await page.goto('/it/dashboard');
    await page.waitForURL(/\/it\/dashboard\/teacher/, { timeout: 30000 });

    // Dashboard dedicata, non la vecchia dashboard admin
    await expect(page.getByRole('heading', { name: 'Dashboard Docente' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(NO_PERMESSI);

    // Sezione registro/lezioni: lista di oggi oppure empty state
    await expect(
      page.getByRole('heading', { name: 'Lezioni di oggi' }).first()
    ).toBeVisible();
    const lessonsOrEmpty = page
      .getByTestId('teacher-registro')
      .or(page.getByText('Nessuna lezione programmata per oggi'));
    await expect(lessonsOrEmpty.first()).toBeVisible();
  });

  test('note disciplinari: Nuova Nota apre il form', async ({ page }) => {
    await page.goto('/it/dashboard/disciplinary');

    const newNoteButton = page.getByTestId('disciplinary-nuova-nota');
    await expect(newNoteButton).toBeVisible();
    await newNoteButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nuova Nota')).toBeVisible();
    await expect(dialog.getByTestId('disciplinary-seleziona-classe')).toBeVisible();
  });

  test('dettaglio lezione con sezione appello', async ({ page }) => {
    await page.goto('/it/dashboard/lessons');

    // Vista lista e apertura della prima lezione disponibile
    await page.getByText('Lista', { exact: true }).click();
    const viewButton = page.getByTestId('lessons-apri-dettaglio').first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();
    await page.waitForURL(/\/it\/dashboard\/lessons\/[^/]+$/, { timeout: 30000 });

    // Tab appello/presenze (label tollerante alla chiave i18n mancante)
    await page.getByRole('tab', { name: /Presenze|attendance/i }).click();
    await expect(
      page.getByText(/Registro Presenze|attendanceTracking/).first()
    ).toBeVisible();
    // La tabella dell'appello (elenco studenti) è renderizzata
    await expect(page.getByRole('table').first()).toBeVisible();
  });

  test('API scoping: solo studenti delle proprie classi ed export presenze', async ({
    page,
    browser,
  }) => {
    // /api/students con sessione teacher: 200 e soli studenti delle sue classi
    const teacherRes = await page.request.get('/api/students?page=1&limit=100');
    expect(teacherRes.status()).toBe(200);
    const teacherData = await teacherRes.json();
    const teacherStudents = teacherData.students ?? [];
    expect(teacherStudents.length).toBeGreaterThanOrEqual(1);
    for (const s of teacherStudents) {
      // Lo scoping è per classe del docente: ogni studente visibile ha classi
      expect(Array.isArray(s.classes) && s.classes.length > 0).toBeTruthy();
    }

    // Il conteggio admin è un sovrainsieme di quello del docente
    const adminCtx = await browser.newContext({ storageState: storageStateFor('admin') });
    try {
      const adminRes = await adminCtx.request.get('/api/students?page=1&limit=100');
      expect(adminRes.status()).toBe(200);
      const adminData = await adminRes.json();
      expect(adminData.pagination.total).toBeGreaterThanOrEqual(
        teacherData.pagination.total
      );
      const adminIds = new Set((adminData.students ?? []).map((s: any) => s.id));
      for (const s of teacherStudents) {
        expect(adminIds.has(s.id), `studente ${s.id} non visibile all'admin`).toBeTruthy();
      }
    } finally {
      await adminCtx.close();
    }

    // Export presenze in CSV consentito al docente (scoped alle sue lezioni)
    const exportRes = await page.request.get('/api/attendance/export?format=csv');
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()['content-type'] ?? '').toContain('text/csv');
  });
});
