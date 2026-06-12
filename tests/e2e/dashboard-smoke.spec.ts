import { test, expect } from '@playwright/test';
import { completeOnboarding, storageStateFor } from './helpers/auth';

// Tutta la suite usa la sessione admin salvata dal progetto di setup.
test.use({ storageState: storageStateFor('admin') });

/**
 * Smoke sweep: visita ogni pagina della dashboard come admin e verifica
 * che renderizzi senza errori fatali (error boundary / overlay Next / 500).
 * Raccoglie anche gli errori di console per pagina.
 */
const ADMIN_ROUTES = [
  '/it/dashboard',
  '/it/dashboard/students',
  '/it/dashboard/teachers',
  '/it/dashboard/classes',
  '/it/dashboard/lessons',
  '/it/dashboard/subjects',
  '/it/dashboard/courses',
  '/it/dashboard/academic-years',
  '/it/dashboard/grades',
  '/it/dashboard/report-cards',
  '/it/dashboard/attendance',
  '/it/dashboard/homework',
  '/it/dashboard/disciplinary',
  '/it/dashboard/communication',
  '/it/dashboard/notices',
  '/it/dashboard/meetings',
  '/it/dashboard/payments',
  '/it/dashboard/invoices',
  '/it/dashboard/payroll',
  '/it/dashboard/accounting',
  '/it/dashboard/billing',
  '/it/dashboard/hours-packages',
  '/it/dashboard/reports',
  '/it/dashboard/analytics',
  '/it/dashboard/schedules',
  '/it/dashboard/admin/users',
];

test.describe('Dashboard smoke (admin)', () => {
  test.beforeAll(async ({ request }) => {
    await completeOnboarding(request);
  });

  for (const route of ADMIN_ROUTES) {
    test(`pagina renderizza: ${route}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Status HTTP non 5xx
      expect(resp?.status() ?? 0, `HTTP status per ${route}`).toBeLessThan(500);

      // Nessun error boundary / overlay Next visibile
      await page.waitForTimeout(1200);
      const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
      const hasFatal =
        /Application error: a client-side exception|Internal Server Error|Unhandled Runtime Error|This page could not be found/i.test(
          bodyText
        );
      expect(hasFatal, `Errore fatale visibile in ${route}: ${bodyText.slice(0, 200)}`).toBeFalsy();

      // Log diagnostico (non blocca) degli errori JS rilevanti
      const relevant = pageErrors.concat(
        consoleErrors.filter(
          (e) =>
            !e.includes('Failed to load resource') &&
            !e.toLowerCase().includes('favicon') &&
            !e.includes('Download the React DevTools')
        )
      );
      if (relevant.length) {
        console.log(`\n⚠️  ${route}\n   ${relevant.slice(0, 5).join('\n   ')}`);
      }
    });
  }
});
