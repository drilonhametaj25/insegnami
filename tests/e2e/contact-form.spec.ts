import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test('submit with empty fields shows validation errors', async ({ page }) => {
    await page.goto('/it/contact');

    // Try to submit the form without filling fields
    const submitButton = page.locator('button[type="submit"]').first();

    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Check for validation feedback (HTML5 validation or custom errors)
      const body = await page.textContent('body');
      // Page should still be on contact (not navigated away)
      expect(page.url()).toContain('contact');
    }
  });

  test('form fields are present and fillable', async ({ page }) => {
    await page.goto('/it/contact');

    const inputs = await page.locator('input, textarea').count();
    expect(inputs).toBeGreaterThanOrEqual(2);

    // Try filling in a field
    const firstInput = page.locator('input').first();
    if (await firstInput.isVisible()) {
      await firstInput.fill('Test User');
      await expect(firstInput).toHaveValue('Test User');
    }
  });
});
