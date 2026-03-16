import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
  test('landing page loads and contains branding', async ({ page }) => {
    await page.goto('/');
    const body = await page.textContent('body');
    expect(body).toContain('InsegnaMi');
  });

  test('pricing page loads and shows plans', async ({ page }) => {
    await page.goto('/it/pricing');
    await expect(page.locator('body')).not.toBeEmpty();
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('contact page loads and renders form', async ({ page }) => {
    await page.goto('/it/contact');
    const formCount = await page.locator('form').count();
    const inputCount = await page.locator('input').count();
    expect(formCount + inputCount).toBeGreaterThan(0);
  });

  test('tools pages load', async ({ page }) => {
    const toolPaths = [
      '/it/tools/calcolatore-costo-studente',
      '/it/tools/calcolatore-presenze',
      '/it/tools/validatore-codice-fiscale',
      '/it/tools/calcolatore-ore-corso',
      '/it/tools/generatore-calendario-scolastico',
      '/it/tools/generatore-comunicazioni',
      '/it/tools/generatore-orario-settimanale',
    ];

    for (const path of toolPaths) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should not 404`).not.toBe(404);
      const body = await page.textContent('body');
      expect(body!.length, `${path} should have content`).toBeGreaterThan(50);
    }
  });
});
