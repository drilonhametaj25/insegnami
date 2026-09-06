const nextJest = require('next/jest')

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.(test|spec).(js|jsx|ts|tsx)',
    '<rootDir>/tests/integration/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  // Ratchet: soglie = baseline misurata meno ~2 punti. Vanno ALZATE man mano
  // che la coverage cresce, mai abbassate.
  // Storia: giu 2026 stmts 10.36 / branch 52.35 / funcs 28.36 → soglie 8/50/26.
  //         set 2026 (post-repair W1-W4) stmts 16.61 / branch 58.09 / funcs
  //         37.54 → soglie 14/55/35.
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 35,
      lines: 14,
      statements: 14,
    },
    // Moduli critici nuovi: tenuti alti fin dall'inizio (path = aggregato
    // della directory, non per-file). NB branches 72: i cron di igiene
    // aggiunti a set 2026 hanno rami minori non coperti (73.01 misurato).
    './lib/workers/': {
      branches: 72,
      functions: 55,
      lines: 75,
      statements: 75,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config)
