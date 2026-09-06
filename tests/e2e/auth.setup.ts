import { test as setup, expect } from '@playwright/test';
import { ACCOUNTS, Role, SEED_TENANT_SLUG, SECOND_TENANT_SLUG, AUTH_DIR, storageStateFor } from './helpers/auth';
import fs from 'fs';

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

/**
 * Autentica una volta sola ciascun ruolo e salva lo storage state, così i
 * test riutilizzano la sessione senza ri-loggarsi (evita il rate-limit del
 * login e velocizza la suite). L'onboarding del tenant seed viene completato.
 */
setup('prepara sessioni autenticate', async ({ browser, request }) => {
  // 5 login sequenziali + compilazione pagine/API in dev: serve più tempo
  // (la prima volta il warm-up paga la compilazione on-demand di ~30 route)
  setup.setTimeout(480_000);
  // Assicura onboarding completo per non far rimbalzare l'admin sul wizard
  await request.post('/api/test', {
    data: { action: 'complete-onboarding', slug: SEED_TENANT_SLUG },
  });
  // Idem per il secondo tenant (usato dai test di isolamento tenant)
  await request.post('/api/test', {
    data: { action: 'complete-onboarding', slug: SECOND_TENANT_SLUG },
  });

  const roles: Role[] = ['admin', 'director', 'secretary', 'teacher', 'student', 'parent', 'admin2'];
  for (const role of roles) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const acct = ACCOUNTS[role];
    await page.goto('/it/auth/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(acct.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(acct.password);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.waitForURL(/\/(it\/)?(dashboard|onboarding)/, { timeout: 30000 });
    await ctx.storageState({ path: storageStateFor(role) });
    await ctx.close();
  }

  // Warm-up delle API route più usate: in dev Next compila le route on-demand
  // (e le smonta se inattive), con prime risposte da 15-25s che sforano i
  // timeout delle expect. Pagarle qui, nel setup, rende i test deterministici.
  if (!process.env.CI) {
    const adminCtx = await browser.newContext({ storageState: storageStateFor('admin') });
    const api = adminCtx.request;
    const warmPaths = [
      '/api/students?page=1&limit=1',
      '/api/teachers?page=1&limit=1',
      '/api/classes?page=1&limit=1',
      '/api/courses?page=1&limit=1',
      '/api/subjects?page=1&limit=1',
      '/api/lessons?page=1&limit=1',
      '/api/payments?page=1&limit=1',
      '/api/notices?page=1&limit=1',
      '/api/homework?page=1&limit=1',
      '/api/accounting/movements?page=1&pageSize=1',
      '/api/accounting/pnl?trend=1',
      '/api/payroll/periods',
      '/api/messages/templates',
      '/api/messages/groups',
      '/api/invoices/settings',
      '/api/invoices/series',
      '/api/invoices/customer-profiles',
      '/api/notifications?unreadOnly=true&limit=1',
      // Route dinamiche/POST-only: anche un GET con id fittizio (404/405)
      // forza la compilazione del modulo della route.
      '/api/subscriptions',
      '/api/subscriptions/plans',
      '/api/subscriptions/checkout',
      '/api/subscriptions/change-plan',
      '/api/subscriptions/addons',
      '/api/payroll/periods/warmup/generate',
      '/api/payroll/warmup',
      '/api/payroll/warmup/approve',
      '/api/payroll/warmup/mark-paid',
      '/api/teachers/warmup/payroll-settings',
      '/api/teachers/stats',
      '/api/invoices?page=1&pageSize=1',
      '/api/invoices/warmup',
      '/api/invoices/warmup/issue',
      '/api/lessons/warmup',
      '/api/lessons/recurring',
      '/api/lessons/stats',
      '/api/students/stats',
      '/api/classes/stats',
      '/api/courses/stats',
      '/api/subjects/stats',
      '/api/notices/stats',
      '/api/payments/stats',
      '/api/attendance/stats',
      '/api/dashboard/admin/stats',
      // Pagine dashboard pesanti: la compilazione del bundle client in dev
      // (anche 30-40s) blocca le risposte API di TUTTI i worker paralleli.
      '/it/dashboard',
      '/it/dashboard/classes',
      '/it/dashboard/classes/warmup',
      '/it/dashboard/lessons',
      '/it/dashboard/lessons/warmup',
      '/it/dashboard/subjects',
      '/it/dashboard/notices',
      '/it/dashboard/homework',
      '/it/dashboard/payments',
      '/it/dashboard/accounting',
      '/it/dashboard/communication',
      '/it/dashboard/payroll',
      '/it/dashboard/payroll/warmup',
      '/it/dashboard/teachers',
      '/it/dashboard/teachers/warmup',
      '/it/dashboard/invoices',
      '/it/dashboard/invoices/settings',
      '/it/dashboard/invoices/new',
      '/it/dashboard/invoices/warmup',
      '/it/dashboard/billing',
      '/it/dashboard/admin/users',
      '/it/pricing',
      '/it/onboarding',
      '/it/auth/register',
      '/api/auth/verify-email',
      // Pagine pubbliche usate da public-pages/contact-form
      '/it/contact',
      '/it/tools/calcolatore-costo-studente',
      '/it/tools/calcolatore-presenze',
      '/it/tools/validatore-codice-fiscale',
      '/it/tools/calcolatore-ore-corso',
      '/it/tools/generatore-calendario-scolastico',
      '/it/tools/generatore-comunicazioni',
      '/it/tools/generatore-orario-settimanale',
    ];
    // Piccoli batch concorrenti: webpack serializza comunque le compilazioni,
    // ma si ammortizza l'overhead per-richiesta (auth/sessione).
    const BATCH = 4;
    for (let i = 0; i < warmPaths.length; i += BATCH) {
      await Promise.all(
        warmPaths.slice(i, i + BATCH).map((path) => api.get(path).catch(() => {}))
      );
    }
    await adminCtx.close();
  }
});
