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
  // Ratchet: soglie = baseline misurata (giu 2026: stmts 10.36 / branch 52.35
  // / funcs 28.36) meno ~2 punti. Vanno ALZATE man mano che la coverage
  // cresce, mai abbassate. Il vecchio 70% globale era irrealistico e la CI
  // lo bypassava del tutto.
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 26,
      lines: 8,
      statements: 8,
    },
    // Moduli critici nuovi: tenuti alti fin dall'inizio (path = aggregato
    // della directory, non per-file)
    './lib/workers/': {
      branches: 75,
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
