import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

/**
 * Permessi a livello DATI: ogni ruolo deve vedere via API solo i dati di
 * propria competenza (genitore → solo i propri figli, studente → solo i
 * propri dati). Verifica lo scoping server-side.
 */

test.describe('Permessi dati — ADMIN (vede tutto)', () => {
  test.use({ storageState: storageStateFor('admin') });

  test('admin vede tutti i pagamenti e tutti gli studenti', async ({ page }) => {
    const pay = await (await page.request.get('/api/payments?page=1&limit=100')).json();
    const payments = pay.payments || pay.data || [];
    expect(payments.length).toBeGreaterThan(1);

    const stu = await (await page.request.get('/api/students?page=1&limit=100')).json();
    const students = stu.students || stu.data || [];
    expect(students.length).toBeGreaterThanOrEqual(6);
  });
});

test.describe('Permessi dati — PARENT (solo i propri figli)', () => {
  test.use({ storageState: storageStateFor('parent') });

  test('il genitore vede solo i pagamenti del proprio figlio @smoke', async ({ page }) => {
    const res = await page.request.get('/api/payments?page=1&limit=100');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const payments = data.payments || data.data || [];
    // Tutti i pagamenti visibili devono riferirsi al figlio del genitore (Marco)
    for (const p of payments) {
      const name = `${p.student?.firstName ?? ''}`.toLowerCase();
      expect(name).toContain('marco');
    }
  });

  test('il genitore NON può elencare tutti gli studenti', async ({ page }) => {
    const res = await page.request.get('/api/students?page=1&limit=100');
    // Endpoint riservato (403) oppure scoped ai soli figli
    if (res.status() === 200) {
      const data = await res.json();
      const students = data.students || data.data || [];
      for (const s of students) {
        expect(`${s.firstName}`.toLowerCase()).toContain('marco');
      }
    } else {
      expect(res.status()).toBe(403);
    }
  });
});

test.describe('Permessi dati — STUDENT (solo i propri voti)', () => {
  test.use({ storageState: storageStateFor('student') });

  test('lo studente vede solo i propri voti (visibili)', async ({ page }) => {
    const res = await page.request.get('/api/grades?page=1&limit=100');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const grades = data.grades || data.data || [];
    // Tutti i voti devono essere visibili e dello studente loggato (Marco)
    for (const g of grades) {
      if (g.isVisible === false) {
        throw new Error('Lo studente non deve vedere voti non visibili');
      }
      if (g.student?.firstName) {
        expect(`${g.student.firstName}`.toLowerCase()).toContain('marco');
      }
    }
  });

  test('lo studente NON può elencare tutti gli studenti @smoke', async ({ page }) => {
    const res = await page.request.get('/api/students?page=1&limit=100');
    expect([401, 403]).toContain(res.status());
  });
});
