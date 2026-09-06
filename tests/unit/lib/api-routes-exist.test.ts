/**
 * Contract smoke API ↔ frontend: ogni literal '/api/...' referenziato da
 * pagine, componenti e hook deve corrispondere a una route esistente in
 * app/api. Impedisce il ripetersi degli "endpoint fantasma" (chiamate
 * client verso route mai scritte, 404 garantiti in produzione).
 *
 * KNOWN_MISSING è un ratchet: gli endpoint fantasma ereditati dall'audit
 * sono elencati lì finché la wave che li risolve non li crea (o non rimuove
 * la chiamata client). Rimuovere una voce quando l'endpoint nasce; NON
 * aggiungere mai voci nuove: un endpoint nuovo si scrive prima di chiamarlo.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const API_DIR = path.join(ROOT, 'app', 'api');

// Endpoint fantasma noti dall'audit (da risolvere in Wave 2/3):
// la wave che crea la route (o elimina la chiamata) DEVE togliere la voce.
// Wave 2: tutte le voci ereditate sono state risolte (route create o
// chiamate client rimosse). NON aggiungere mai voci nuove.
const KNOWN_MISSING: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Route esistenti come lista di pattern a segmenti ('[x]' = jolly). */
function collectApiRoutes(): string[][] {
  return walk(API_DIR)
    .filter((f) => /route\.tsx?$/.test(f))
    .map((f) => {
      const rel = path
        .relative(path.join(ROOT, 'app'), path.dirname(f))
        .split(path.sep)
        .filter(Boolean);
      return rel; // es. ['api','students','[id]']
    });
}

/** Estrae i path /api/... referenziati dal codice client/frontend. */
function collectClientApiRefs(): { file: string; ref: string }[] {
  const dirs = [
    path.join(ROOT, 'app'),
    path.join(ROOT, 'components'),
    path.join(ROOT, 'lib', 'hooks'),
  ];
  const refs: { file: string; ref: string }[] = [];
  // literal in apici o template: cattura fino a apice/backtick/spazio/?
  const re = /['"`](\/api\/[^'"`\s?#]+)/g;

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (file.includes(`${path.sep}api${path.sep}`)) continue; // niente self-ref delle route
      if (/\.(test|spec)\.tsx?$/.test(file)) continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(re)) {
        refs.push({ file: path.relative(ROOT, file), ref: m[1] });
      }
    }
  }
  return refs;
}

/**
 * Normalizza un ref: ${...} completi → '*'; placeholder incompleti (template
 * annidati troncati dalla regex) o '*' incollato a fine segmento (query
 * string costruita in template: '/api/invoices${qs}') → il path termina lì.
 */
function normalizeRef(ref: string): string[] | null {
  let cleaned = ref.replace(/\$\{[^}]*\}/g, '*');
  // '${' residuo = placeholder troncato: il path certo finisce prima
  const brokenAt = cleaned.indexOf('${');
  if (brokenAt !== -1) cleaned = cleaned.slice(0, brokenAt);
  cleaned = cleaned.replace(/\/+$/, '');

  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  // '*' incollato in coda all'ultimo segmento (es. 'invoices*'): è una query
  // string in template → il segmento è quello, senza wildcard
  const last = segments[segments.length - 1];
  if (last !== '*' && last.endsWith('*')) {
    segments[segments.length - 1] = last.slice(0, -1);
  }
  if (segments[segments.length - 1] === '') segments.pop();
  // '/api/${qualcosa}' completamente dinamico dopo /api → non verificabile
  if (segments.length < 2) return null;
  if (segments.slice(1).every((s) => s === '*')) return null;
  return segments;
}

function matchesRoute(refSegs: string[], routeSegs: string[]): boolean {
  if (refSegs.length !== routeSegs.length) return false;
  for (let i = 0; i < refSegs.length; i++) {
    const route = routeSegs[i];
    const ref = refSegs[i];
    if (route.startsWith('[') && route.endsWith(']')) continue; // segmento dinamico
    if (ref === '*') continue; // placeholder template nel client
    if (route !== ref) return false;
  }
  return true;
}

function isKnownMissing(refSegs: string[]): boolean {
  return KNOWN_MISSING.some((known) => {
    const knownSegs = known.split('/').filter(Boolean);
    if (knownSegs.length !== refSegs.length) return false;
    return knownSegs.every(
      (k, i) => k === '*' || refSegs[i] === '*' || k === refSegs[i]
    );
  });
}

describe('contract smoke: literal /api/ del frontend ↔ route reali', () => {
  const routes = collectApiRoutes();
  const refs = collectClientApiRefs();

  it('trova un numero plausibile di route e riferimenti', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(refs.length).toBeGreaterThan(100);
  });

  it('ogni riferimento client punta a una route esistente (o è nel ratchet KNOWN_MISSING)', () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const { file, ref } of refs) {
      const segs = normalizeRef(ref);
      if (!segs) continue;
      const key = segs.join('/');
      if (seen.has(key)) continue;
      seen.add(key);

      const exists = routes.some((r) => matchesRoute(segs, r));
      if (!exists && !isKnownMissing(segs)) {
        missing.push(`${ref}  (es. in ${file})`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('il ratchet KNOWN_MISSING non contiene voci ormai risolte', () => {
    const stale: string[] = [];
    for (const known of KNOWN_MISSING) {
      const knownSegs = known.split('/').filter(Boolean);
      const nowExists = routes.some((r) => matchesRoute(knownSegs, r));
      if (nowExists) stale.push(known);
    }
    expect(stale).toEqual([]);
  });
});
