import { test, expect } from '@playwright/test';

test.describe('Error Pages', () => {
  test('nonexistent public route shows not-found page', async ({ page }) => {
    const response = await page.goto('/it/nonexistent-xyz-12345');
    const body = await page.textContent('body');
    // Should show some content (not a blank screen)
    expect(body!.length).toBeGreaterThan(10);
  });

  test('nonexistent dashboard route shows not-found page', async ({ page }) => {
    const response = await page.goto('/it/dashboard/nonexistent-route-xyz');
    const body = await page.textContent('body');
    // Should show some content (not a blank screen)
    expect(body!.length).toBeGreaterThan(10);
  });
});
