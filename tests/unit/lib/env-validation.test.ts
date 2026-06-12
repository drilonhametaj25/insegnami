/**
 * Test per lib/env-validation.ts (B2.4)
 * - REDIS_URL fatale in produzione (skip durante la build Next)
 * - Warning non fatali per SUPERADMIN_PASSWORD / POSTGRES_PASSWORD insicure
 * - Regressione: comportamento NEXTAUTH_SECRET invariato
 */
import { validateEnv } from '@/lib/env-validation';

// NODE_ENV è tipizzato readonly da Next: helper per riassegnarlo nei test
function setNodeEnv(value: string) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

// Environment minimo valido per superare lo schema zod
function applyBaseEnv() {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/insegnami';
  process.env.NEXTAUTH_URL = 'https://app.example.com';
  process.env.NEXTAUTH_SECRET = 'Kx9mP2vQ7rT4wY8zA3bC6dE1fG5hJ0nL';
  // Pulizia delle variabili che i test manipolano (potrebbero arrivare dal .env locale)
  delete process.env.REDIS_URL;
  delete process.env.NEXT_PHASE;
  delete process.env.MODE;
  delete process.env.SUPERADMIN_PASSWORD;
  delete process.env.POSTGRES_PASSWORD;
}

describe('validateEnv', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Backup dell'environment prima di ogni manipolazione
    originalEnv = { ...process.env };
    applyBaseEnv();
    // Silenzia i log di validazione nei test
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore completo di environment e console
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('REDIS_URL in produzione (fatale)', () => {
    it('in produzione senza REDIS_URL lancia un errore', () => {
      setNodeEnv('production');

      expect(() => validateEnv()).toThrow(/REDIS_URL/);
    });

    it('in produzione con REDIS_URL configurato passa', () => {
      setNodeEnv('production');
      process.env.REDIS_URL = 'redis://localhost:6379';

      const result = validateEnv();
      expect(result.success).toBe(true);
    });

    it('durante la build di Next (phase-production-build) il check fatale viene saltato', () => {
      // Il job CI di build non setta REDIS_URL: non deve fallire
      setNodeEnv('production');
      process.env.NEXT_PHASE = 'phase-production-build';

      const result = validateEnv();
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('REDIS_URL')])
      );
    });

    it('in development senza REDIS_URL produce solo un warning', () => {
      setNodeEnv('development');

      const result = validateEnv();
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('REDIS_URL')])
      );
    });
  });

  describe('NEXTAUTH_SECRET insicuro (regressione, comportamento invariato)', () => {
    it('in development un secret insicuro fa fallire la parse senza lanciare', () => {
      setNodeEnv('development');
      // Contiene "changeme" (lista UNSAFE_SECRETS) ed è lungo >= 32 caratteri
      process.env.NEXTAUTH_SECRET = 'changeme-changeme-changeme-changeme';

      const result = validateEnv();
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('NEXTAUTH_SECRET')])
      );
    });

    it('in produzione un secret insicuro lancia un errore', () => {
      setNodeEnv('production');
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.NEXTAUTH_SECRET = 'changeme-changeme-changeme-changeme';

      expect(() => validateEnv()).toThrow(/NEXTAUTH_SECRET/);
    });
  });

  describe('password insicure (warning non fatale)', () => {
    it("SUPERADMIN_PASSWORD='admin123' produce un warning ma non fallisce", () => {
      setNodeEnv('production');
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.SUPERADMIN_PASSWORD = 'admin123';

      const result = validateEnv();
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('SUPERADMIN_PASSWORD')])
      );
    });

    it("POSTGRES_PASSWORD='changeme' produce un warning ma non fallisce", () => {
      setNodeEnv('production');
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.POSTGRES_PASSWORD = 'changeme';

      const result = validateEnv();
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('POSTGRES_PASSWORD')])
      );
    });

    it('password robuste non producono warning', () => {
      setNodeEnv('production');
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.SUPERADMIN_PASSWORD = 'Xk7#mQ9$vR2&wZ5!';
      process.env.POSTGRES_PASSWORD = 'pG4^nB8*jL1@hF6%';

      const result = validateEnv();
      expect(result.success).toBe(true);
      expect(result.warnings ?? []).not.toEqual(
        expect.arrayContaining([expect.stringContaining('SUPERADMIN_PASSWORD')])
      );
      expect(result.warnings ?? []).not.toEqual(
        expect.arrayContaining([expect.stringContaining('POSTGRES_PASSWORD')])
      );
    });
  });
});
