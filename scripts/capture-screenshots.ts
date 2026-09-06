/**
 * Cattura screenshot reali del prodotto per la homepage pubblica.
 *
 * Uso: npx tsx scripts/capture-screenshots.ts
 * Prerequisiti: dev server attivo su http://localhost:3018 (o BASE_URL) con DB
 * seedato e storage state e2e già generati (tests/e2e/.auth/*.json).
 *
 * Output: 6 PNG 1440x900 in public/images/screenshots/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3018';
const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'screenshots');
const AUTH_DIR = path.join(process.cwd(), 'tests', 'e2e', '.auth');
const VIEWPORT = { width: 1440, height: 900 };

async function newAuthedPage(
  browser: Browser,
  authFile: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: path.join(AUTH_DIR, authFile),
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  });
  const page = await context.newPage();
  return { context, page };
}

/** Attende dati caricati: networkidle (best-effort), selettore visibile, nessun loader residuo. */
async function settle(page: Page, readySelector: string) {
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
  await page.waitForSelector(readySelector, { state: 'visible', timeout: 45_000 });
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll(
          '.mantine-Loader-root, .mantine-LoadingOverlay-root, .mantine-Skeleton-root[data-visible]'
        ).length === 0,
      undefined,
      { timeout: 30_000 }
    )
    .catch(() => {});
  // Nasconde l'indicatore di build/dev-tools di Next (viewport pulito)
  await page
    .addStyleTag({ content: 'nextjs-portal{display:none!important}' })
    .catch(() => {});
  await page.waitForTimeout(1500);
}

async function shot(page: Page, file: string) {
  const filePath = path.join(OUT_DIR, file);
  await page.screenshot({ path: filePath });
  const kb = Math.round(fs.statSync(filePath).size / 1024);
  console.log(`  saved ${file} (${kb} KB)`);
}

/** Trova una lezione con appello compilato (attendance non vuoto). */
async function findLessonWithAttendance(page: Page): Promise<string | null> {
  for (const query of ['status=COMPLETED&limit=15', 'limit=15']) {
    const res = await page.request.get(`${BASE_URL}/api/lessons?${query}`);
    if (!res.ok()) continue;
    const data = await res.json();
    const lessons: Array<{ id: string }> = data.lessons ?? [];
    for (const lesson of lessons) {
      const detailRes = await page.request.get(`${BASE_URL}/api/lessons/${lesson.id}`);
      if (!detailRes.ok()) continue;
      const detail = await detailRes.json();
      const attendance = detail.attendance ?? detail.lesson?.attendance ?? [];
      if (Array.isArray(attendance) && attendance.length > 0) return lesson.id;
    }
    // fallback: prima lezione della lista, anche senza appello registrato
    if (lessons.length > 0) return lessons[0].id;
  }
  return null;
}

/** Filtro opzionale da CLI: `npx tsx scripts/capture-screenshots.ts pagamenti voti` */
const only = process.argv.slice(2);
const want = (name: string) => only.length === 0 || only.includes(name);

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  try {
    // ── Pagine ADMIN ─────────────────────────────────────────────────────
    const { context: adminCtx, page: admin } = await newAuthedPage(browser, 'admin.json');

    if (want('dashboard-admin')) {
      console.log('1/6 dashboard-admin.png');
      await admin.goto(`${BASE_URL}/it/dashboard`, { waitUntil: 'domcontentloaded' });
      await settle(admin, '.mantine-AppShell-main');
      await shot(admin, 'dashboard-admin.png');
    }

    if (want('registro-lezione')) {
      console.log('2/6 registro-lezione.png');
      // Naviga dalla lista lezioni al registro/appello della lezione
      await admin.goto(`${BASE_URL}/it/dashboard/lessons`, { waitUntil: 'domcontentloaded' });
      await settle(admin, '.mantine-AppShell-main');
      const lessonId = await findLessonWithAttendance(admin);
      if (!lessonId) throw new Error('Nessuna lezione trovata nel tenant seedato');
      await admin.goto(`${BASE_URL}/it/dashboard/attendance/lesson/${lessonId}`, {
        waitUntil: 'domcontentloaded',
      });
      await settle(admin, 'text=Lista Presenze');
      await shot(admin, 'registro-lezione.png');
    }

    if (want('voti')) {
      console.log('3/6 voti.png');
      await admin.goto(`${BASE_URL}/it/dashboard/grades`, { waitUntil: 'domcontentloaded' });
      await settle(admin, '.mantine-AppShell-main');
      await shot(admin, 'voti.png');
    }

    if (want('pagamenti')) {
      console.log('4/6 pagamenti.png');
      await admin.goto(`${BASE_URL}/it/dashboard/payments`, { waitUntil: 'domcontentloaded' });
      await settle(admin, '.mantine-AppShell-main');
      // Tab "Pagamenti": lista completa, più leggibile della panoramica
      await admin.getByRole('tab', { name: 'Pagamenti' }).click();
      await admin.waitForSelector('table', { state: 'visible', timeout: 20_000 }).catch(() => {});
      await admin.waitForTimeout(800);
      await shot(admin, 'pagamenti.png');
    }

    if (want('comunicazioni')) {
      console.log('5/6 comunicazioni.png');
      await admin.goto(`${BASE_URL}/it/dashboard/communication`, { waitUntil: 'domcontentloaded' });
      await settle(admin, '.mantine-AppShell-main');
      await shot(admin, 'comunicazioni.png');
    }

    await adminCtx.close();

    // ── Portale genitori (storage state parent) ──────────────────────────
    if (want('portale-genitori')) {
      const { context: parentCtx, page: parent } = await newAuthedPage(browser, 'parent.json');

      console.log('6/6 portale-genitori.png');
      await parent.goto(`${BASE_URL}/it/dashboard/parent`, { waitUntil: 'domcontentloaded' });
      await settle(parent, '.mantine-AppShell-main');
      await shot(parent, 'portale-genitori.png');

      await parentCtx.close();
    }

    console.log('Fatto: screenshot in public/images/screenshots/');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
