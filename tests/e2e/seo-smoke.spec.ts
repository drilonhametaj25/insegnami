import { test, expect } from '@playwright/test';

/**
 * Smoke SEO delle pagine pubbliche: status 200, canonical self-referente,
 * hreflang completi (it/en/fr/pt + x-default), title non vuoto e distinto
 * tra pagine diverse, og:image raggiungibile.
 *
 * Esecuzione:
 *   BASE_URL=http://localhost:3018 npx playwright test tests/e2e/seo-smoke.spec.ts --project=chromium --workers=1
 */

const SITE_URL = 'https://insegnami.pro';
const LOCALES = ['it', 'en', 'fr', 'pt'] as const;

// URL rappresentative di tutte le famiglie di pagine pubbliche
const PUBLIC_PATHS = [
  '/it',
  '/it/pricing',
  '/it/contact',
  '/it/tools',
  '/it/tools/calcolatore-media-voti',
  '/it/privacy',
  '/it/blog',
  '/it/citta',
  '/en',
  '/en/pricing',
];

/** Path senza il prefisso locale ('/it/pricing' → '/pricing', '/en' → ''). */
function pathWithoutLocale(path: string): string {
  return path.replace(/^\/(it|en|fr|pt)(?=\/|$)/, '');
}

test.describe('SEO smoke pagine pubbliche', () => {
  test('canonical, hreflang, title e og:image', async ({ page, request }) => {
    // In dev ogni route compila al primo accesso: serve un timeout largo
    test.setTimeout(600_000);

    const titles = new Map<string, string>();
    const ogImages = new Set<string>();

    for (const path of PUBLIC_PATHS) {
      const response = await page.goto(path, { waitUntil: 'load' });

      // 1. Status 200 (hard: senza pagina non ha senso proseguire)
      expect(response?.status(), `${path} deve rispondere 200`).toBe(200);

      const rest = pathWithoutLocale(path);

      // Le assertion per-pagina sono soft: un tag mancante su una pagina non
      // deve nascondere lo stato di tutte le altre.

      // 2. Canonical self-referente (dominio di produzione + path corrente)
      const canonical = await page.locator('link[rel="canonical"]').all();
      expect.soft(canonical.length, `${path}: canonical mancante o duplicato`).toBe(1);
      if (canonical.length === 1) {
        expect
          .soft(await canonical[0].getAttribute('href'), `${path}: canonical non self-referente`)
          .toBe(`${SITE_URL}${path}`);
      }

      // 3. Hreflang: 4 locali + x-default, tutti sullo stesso path
      for (const l of LOCALES) {
        const alt = await page.locator(`link[rel="alternate"][hreflang="${l}"]`).all();
        expect.soft(alt.length, `${path}: hreflang ${l} mancante o duplicato`).toBe(1);
        if (alt.length === 1) {
          expect
            .soft(await alt[0].getAttribute('href'), `${path}: hreflang ${l} errato`)
            .toBe(`${SITE_URL}/${l}${rest}`);
        }
      }
      const xDefault = await page
        .locator('link[rel="alternate"][hreflang="x-default"]')
        .all();
      expect.soft(xDefault.length, `${path}: x-default mancante o duplicato`).toBe(1);
      if (xDefault.length === 1) {
        expect
          .soft(await xDefault[0].getAttribute('href'), `${path}: x-default errato`)
          .toBe(`${SITE_URL}/it${rest}`);
      }

      // 4. Title non vuoto
      const title = (await page.title()).trim();
      expect.soft(title.length, `${path}: title vuoto`).toBeGreaterThan(0);
      titles.set(path, title);

      // 5. og:image dichiarata
      const ogImageTags = await page.locator('meta[property="og:image"]').all();
      const ogImage = ogImageTags.length > 0 ? await ogImageTags[0].getAttribute('content') : null;
      expect.soft(ogImage, `${path}: og:image mancante`).toBeTruthy();
      if (ogImage) ogImages.add(ogImage);
    }

    // Title unici tra pagine diverse dello stesso locale (le varianti /en del
    // sito pubblico condividono ancora la copy italiana, quindi il confronto
    // per unicità si fa sulle pagine /it) e almeno 3 title distinti nel set.
    const itTitles = [...titles.entries()].filter(([p]) => p.startsWith('/it'));
    const distinctItTitles = new Set(itTitles.map(([, t]) => t));
    expect
      .soft(
        distinctItTitles.size,
        `Title duplicati tra pagine /it: ${JSON.stringify([...itTitles])}`
      )
      .toBe(itTitles.length);
    expect(new Set(titles.values()).size).toBeGreaterThanOrEqual(3);

    // 6. og:image raggiungibile: l'URL dichiarato punta al dominio di
    // produzione, quindi si verifica lo stesso asset sul server locale
    for (const image of ogImages) {
      const imagePath = new URL(image, SITE_URL).pathname;
      const head = await request.head(imagePath);
      expect.soft(head.status(), `og:image ${imagePath} deve rispondere 200 (HEAD)`).toBe(200);
    }
  });
});
