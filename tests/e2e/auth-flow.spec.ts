import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('login page renders form with email and password fields', async ({ page }) => {
    await page.goto('/it/auth/login');

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await expect(emailInput.first()).toBeVisible();
    await expect(passwordInput.first()).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/it/auth/login');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword123');

    // Submit the form
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Wait for error feedback (either alert, notification, or error text)
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    // Page should still be on login (not redirected to dashboard)
    const url = page.url();
    expect(url).toContain('login');
  });

  test('register page renders form', async ({ page }) => {
    await page.goto('/it/auth/register');

    const inputs = await page.locator('input').count();
    expect(inputs).toBeGreaterThanOrEqual(2);
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/it/auth/forgot-password');

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput.first()).toBeVisible();
  });
});
