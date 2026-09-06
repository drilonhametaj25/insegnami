import { test, expect } from '@playwright/test';

/**
 * Smoke test i18n del sito pubblico: le homepage /en, /fr e /pt devono
 * rispondere 200, avere <html lang> corretto (impostato dallo script inline
 * prima dell'idratazione) e mostrare l'hero TRADOTTO (stringa distintiva da
 * public.home.hero per ogni lingua, mai il fallback italiano).
 */

const HERO_BY_LOCALE: Record<string, string> = {
  en: 'The complete management software',
  fr: 'Le logiciel de gestion complet',
  pt: 'O sistema de gestão completo',
};

for (const locale of ['en', 'fr', 'pt'] as const) {
  test(`homepage /${locale}: 200, html lang e hero tradotto`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    expect(response, 'la homepage deve rispondere').not.toBeNull();
    expect(response!.status()).toBe(200);

    // <html lang> è aggiornato da uno script inline sincrono: dopo il load
    // deve riflettere il locale del segmento URL.
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.lang))
      .toBe(locale);

    // Hero tradotto: stringa distintiva della lingua (da public.home.hero).
    await expect(
      page.getByRole('heading', { level: 1 })
    ).toContainText(HERO_BY_LOCALE[locale]);

    // La CTA principale del hero esiste (data-testid stabile).
    await expect(page.getByTestId('home-cta-trial')).toBeVisible();
  });
}

test('pricing /en: 200 con prezzi visibili', async ({ page }) => {
  const response = await page.goto('/en/pricing');
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);

  // Hero tradotto della pagina prezzi.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Choose the perfect plan'
  );

  // Prezzi visibili: almeno un importo in euro nel primo card di piano.
  const prices = page.locator('text=/€\\d+/');
  await expect(prices.first()).toBeVisible();
  expect(await prices.count()).toBeGreaterThan(0);

  // Bottoni di sottoscrizione dei piani presenti.
  await expect(page.getByTestId(/subscribe-/).first()).toBeVisible();
});
