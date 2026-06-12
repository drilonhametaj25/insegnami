/**
 * Setup del progetto integration-DB (jest.config.integration.js).
 *
 * Differenze deliberate rispetto a jest.setup.ts (suite jsdom):
 *   - NIENTE mock di next/server: i route handler vengono invocati con
 *     NextRequest/NextResponse REALI. In ambiente node con Node 18+ i globali
 *     Request/Response/Headers/fetch esistono, quindi Next li usa direttamente.
 *   - NIENTE MSW: qui si testa contro un Postgres vero, non si intercetta HTTP.
 *   - Mock SOLO di @/lib/redis: evita connessioni di rete e rende deterministico
 *     il verdetto di getTenantAccessCached (cache in-memory per file di test).
 *     Il mock di @/lib/auth#getAuth invece è per-test (ogni file impersona
 *     l'admin della propria fixture).
 */

// I test toccano un DB reale: 30s di timeout per query + migrazioni lente in CI.
jest.setTimeout(30000)

// Redis in-memory: stessa interfaccia di RedisManager (lib/redis.ts).
// Niente TTL reale — ogni file di test ha il proprio module registry, quindi
// lo store non sopravvive tra file e non può inquinare altri tenant fixture.
jest.mock('@/lib/redis', () => {
  const store = new Map<string, string>()
  const redisMock = {
    getClient: () => null,
    getConnectionConfig: () => ({ host: 'localhost', port: 6379 }),
    async get(key: string) {
      return store.get(key) ?? null
    },
    async set(key: string, value: string, _ttl?: number) {
      store.set(key, value)
      return true
    },
    async setNX(key: string, value: string, _ttlSeconds: number) {
      if (store.has(key)) return false
      store.set(key, value)
      return true
    },
    async del(key: string) {
      store.delete(key)
      return true
    },
    async getJSON(key: string) {
      const data = store.get(key)
      return data ? JSON.parse(data) : null
    },
    async setJSON(key: string, value: unknown, _ttl?: number) {
      store.set(key, JSON.stringify(value))
      return true
    },
    async invalidatePattern(_pattern: string) {
      return 0
    },
    async invalidateByPrefix(_prefix: string) {
      return 0
    },
    async invalidateUserCache(_userId: string) {
      return 0
    },
    async invalidateTenantCache(_tenantId: string) {
      return 0
    },
    async disconnect() {},
  }
  return { __esModule: true, redis: redisMock, default: redisMock }
})

// Cleanup globale: chiude il pool Prisma del file di test corrente, altrimenti
// jest resta appeso ("open handles") aspettando le connessioni al DB.
afterAll(async () => {
  // Import lazy: evita di istanziare PrismaClient nei (rari) file che non lo usano.
  const { prisma } = require('@/lib/db') as typeof import('@/lib/db')
  await prisma.$disconnect()
})
