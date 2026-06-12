const nextJest = require('next/jest')

/**
 * Progetto Jest SEPARATO per i test di integrazione contro un Postgres REALE
 * (tests/integration-db/**). A differenza di jest.config.js:
 *   - testEnvironment 'node' (niente jsdom): i route handler Next girano con
 *     i Request/Response globali di Node 18+, quindi next/server è quello vero;
 *   - setup dedicato (jest.setup.integration.ts): NIENTE mock di next/server,
 *     niente MSW — solo redis in-memory e cleanup della connessione Prisma;
 *   - maxWorkers 1: i test condividono lo stesso database, l'esecuzione
 *     parallela creerebbe interferenze sui counter/fixture.
 *
 * Richiede DATABASE_URL puntato a un DB di test già migrato
 * (npx prisma migrate deploy). In CI è il service postgres del job `test`.
 */
const createJestConfig = nextJest({
  // Carica next.config.js e i file .env esattamente come jest.config.js
  dir: './',
})

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.ts'],
  testMatch: ['<rootDir>/tests/integration-db/**/*.test.ts'],
  // Stesso alias di jest.config.js — i route handler importano via "@/".
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Serializzazione totale: vedi nota sopra (lo script usa anche --runInBand).
  maxWorkers: 1,
}

// createJestConfig è esportato così perché next/jest carica la config Next in modo asincrono
module.exports = createJestConfig(config)
