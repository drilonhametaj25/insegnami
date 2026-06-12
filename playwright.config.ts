import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Timeout per test: il dev server di Next può essere lento sotto carico */
  timeout: 60 * 1000,
  /* Timeout default delle asserzioni expect() — più tollerante in dev: a
     inizio run (5 worker + dev server sullo stesso host) le prime risposte
     API possono superare i 20s anche a route già compilate */
  expect: { timeout: process.env.CI ? 15 * 1000 : 30 * 1000 },
  /* Un retry locale assorbe la flakiness residua del dev server */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. In locale 2 worker: il dev server Next è
     un singolo processo Node e con 5 chromium paralleli su una workstation
     già carica le risposte API superano i 20-30s (timeout spurii a catena).
     Override possibile con E2E_WORKERS. */
  workers: process.env.CI ? 1 : Number(process.env.E2E_WORKERS || 2),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // In CI si aggiunge il reporter 'github' (annotazioni inline sui PR) mantenendo
  // l'html, che viene caricato come artifact in caso di fallimento.
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Progetto di setup: autentica i ruoli e salva gli storage state.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // Cross-browser disabilitati di default per velocità; riabilitare con
    // --project=firefox/webkit dopo aver installato i browser.
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // In CI si esercita la build di produzione (next build + next start),
    // più stabile e realistica del dev server; in locale resta il dev server
    // con riuso dell'istanza eventualmente già attiva.
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // La build di Next in CI può richiedere diversi minuti: timeout esteso
    timeout: (process.env.CI ? 300 : 120) * 1000,
  },
});
