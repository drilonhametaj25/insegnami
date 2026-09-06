/**
 * Integrità del dataset geografico delle pagine SEO città: ogni comune deve
 * risolvere il proprio contesto (provincia+regione) e ogni provincia deve
 * appartenere a una regione esistente. Il bug storico: 9 capoluoghi
 * referenziavano province assenti → pagine mai generate.
 */

import { regioni, province, comuni, getComuneWithContext } from '@/data/italia';

describe('dataset città (data/italia.ts)', () => {
  it('ogni provincia appartiene a una regione esistente', () => {
    const codes = new Set(regioni.map((r) => r.codice));
    const orphans = province.filter((p) => !codes.has(p.regione));
    expect(orphans.map((p) => p.nome)).toEqual([]);
  });

  it('ogni comune risolve il contesto provincia+regione', () => {
    const broken = comuni
      .filter((c) => getComuneWithContext(c.slug) === null)
      .map((c) => c.nome);
    expect(broken).toEqual([]);
  });

  it('i 9 capoluoghi storicamente rotti ora risolvono', () => {
    for (const slug of [
      'genova',
      'trieste',
      'perugia',
      'livorno',
      'ravenna',
      'rimini',
      'ferrara',
      'pescara',
      'reggio-calabria',
    ]) {
      const comune = comuni.find((c) => c.slug === slug);
      if (comune) {
        expect(getComuneWithContext(slug)).not.toBeNull();
      }
    }
  });

  it('nessun codice provincia duplicato', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const p of province) {
      if (seen.has(p.codice)) dupes.push(p.codice);
      seen.add(p.codice);
    }
    expect(dupes).toEqual([]);
  });
});
