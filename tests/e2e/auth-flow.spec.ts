import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('la pagina di login mostra i campi email e password', async ({ page }) => {
    await page.goto('/it/auth/login');
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByPlaceholder('La tua password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
  });

  test('credenziali non valide non effettuano il login', async ({ page }) => {
    await page.goto('/it/auth/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('invalid@test.com');
    await page.getByPlaceholder('La tua password').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.waitForTimeout(2500);
    // Rimane sulla pagina di login (nessun redirect alla dashboard)
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('la pagina di registrazione mostra il form', async ({ page }) => {
    await page.goto('/it/auth/register');
    await expect(page.getByPlaceholder('Il tuo nome')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crea Account' })).toBeVisible();
  });

  test('la pagina password dimenticata mostra il campo email', async ({ page }) => {
    await page.goto('/it/auth/forgot-password');
    await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible();
  });
});
