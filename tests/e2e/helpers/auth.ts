import { Page, APIRequestContext, expect } from '@playwright/test';
import path from 'path';

export type Role = 'admin' | 'teacher' | 'student' | 'parent';

/** Cartella e path degli storage state salvati dal progetto di setup. */
export const AUTH_DIR = path.join(__dirname, '..', '.auth');
export const storageStateFor = (role: Role) => path.join(AUTH_DIR, `${role}.json`);

export const ACCOUNTS: Record<Role, { email: string; password: string }> = {
  admin: { email: 'admin@englishplus.it', password: 'password' },
  teacher: { email: 'teacher@englishplus.it', password: 'password' },
  student: { email: 'student@englishplus.it', password: 'password' },
  parent: { email: 'parent@englishplus.it', password: 'password' },
};

export const SEED_TENANT_SLUG = 'english-plus';

/** Esegue il login via UI e attende l'atterraggio su dashboard o onboarding. */
export async function login(page: Page, role: Role): Promise<void> {
  const acct = ACCOUNTS[role];
  await page.goto('/it/auth/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(acct.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(acct.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL(/\/(it\/)?(dashboard|onboarding)/, { timeout: 20000 });
}

/** Chiamata all'endpoint helper di test (solo non-produzione). */
export async function testApi(
  request: APIRequestContext,
  body: Record<string, unknown>
): Promise<any> {
  const res = await request.post('/api/test', { data: body });
  return res.json();
}

export async function completeOnboarding(request: APIRequestContext, slug = SEED_TENANT_SLUG) {
  return testApi(request, { action: 'complete-onboarding', slug });
}

export async function resetBilling(request: APIRequestContext, slug = SEED_TENANT_SLUG) {
  return testApi(request, { action: 'reset-billing', slug });
}

export async function setTrial(request: APIRequestContext, slug = SEED_TENANT_SLUG, days = 14) {
  return testApi(request, { action: 'set-trial', slug, days });
}

/** Azzera abbonamento/add-on → trial generoso e pulisce i dati di test. */
export async function resetTestData(request: APIRequestContext, slug = SEED_TENANT_SLUG) {
  return testApi(request, { action: 'reset-test-data', slug });
}
