/**
 * Verifica statica dell'infrastruttura di produzione (B1.1):
 * - docker-compose.prod.yml deve definire il servizio "worker" (BullMQ)
 *   costruito dallo stage dedicato del Dockerfile, con hardening coerente
 *   con il servizio app.
 * - docker/Dockerfile deve contenere lo stage "worker" che lancia tsx
 *   su scripts/start-workers.ts, senza spostare il default build target
 *   (runner deve restare l'ultimo stage).
 */
import fs from 'fs';
import path from 'path';

// js-yaml è una dipendenza transitiva disponibile; niente @types → require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../../..');
const composeRaw = fs.readFileSync(path.join(ROOT, 'docker-compose.prod.yml'), 'utf8');
const compose = yaml.load(composeRaw) as any;
const dockerfile = fs.readFileSync(path.join(ROOT, 'docker', 'Dockerfile'), 'utf8');

describe('docker-compose.prod.yml — servizio worker', () => {
  const worker = compose?.services?.worker;

  it('definisce il servizio worker', () => {
    expect(worker).toBeDefined();
  });

  it('builda dallo stage "worker" del Dockerfile', () => {
    expect(worker.build).toMatchObject({
      context: '.',
      dockerfile: 'docker/Dockerfile',
      target: 'worker',
    });
  });

  it('il servizio app usa il target esplicito "runner"', () => {
    expect(compose.services.app.build.target).toBe('runner');
  });

  it('riparte automaticamente (restart unless-stopped)', () => {
    expect(worker.restart).toBe('unless-stopped');
  });

  it('dipende da postgres e redis healthy', () => {
    expect(worker.depends_on.postgres.condition).toBe('service_healthy');
    expect(worker.depends_on.redis.condition).toBe('service_healthy');
  });

  it('ha REDIS_URL puntato al servizio redis interno', () => {
    const env: string[] = worker.environment;
    expect(env.some((e) => e.startsWith('REDIS_URL=redis://redis:6379'))).toBe(true);
  });

  it('riceve le variabili minime richieste da env-validation in produzione', () => {
    const env: string[] = worker.environment;
    for (const required of ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'NODE_ENV']) {
      expect(env.some((e) => e.startsWith(`${required}=`))).toBe(true);
    }
  });

  it('è hardenizzato come il servizio app', () => {
    expect(worker.security_opt).toContain('no-new-privileges:true');
    expect(worker.cap_drop).toContain('ALL');
    expect(worker.read_only).toBe(true);
    // tsx/esbuild possono scrivere cache: serve almeno una tmpfs
    expect(worker.tmpfs).toEqual(expect.arrayContaining(['/tmp']));
  });

  it('non contiene riferimenti a RESEND', () => {
    expect(composeRaw).not.toMatch(/RESEND/i);
  });
});

describe('docker/Dockerfile — stage worker', () => {
  it('definisce lo stage worker a partire dal builder', () => {
    expect(dockerfile).toMatch(/FROM builder AS worker/i);
  });

  it('lancia tsx su scripts/start-workers.ts', () => {
    expect(dockerfile).toMatch(
      /CMD \["node_modules\/\.bin\/tsx", "scripts\/start-workers\.ts"\]/
    );
  });

  it('lo stage runner resta l\'ultimo (default build target invariato)', () => {
    const fromLines = dockerfile.match(/^FROM .+$/gm) ?? [];
    expect(fromLines[fromLines.length - 1]).toMatch(/AS runner\s*$/i);
  });

  it('lo stage worker gira come utente non-root', () => {
    // estrae il blocco dello stage worker (fino al FROM successivo)
    const workerStage = dockerfile.split(/^FROM /m).find((s) => /^builder AS worker/i.test(s)) ?? '';
    expect(workerStage).toMatch(/^USER (?!root)\S+/m);
  });
});
