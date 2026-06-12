/**
 * slugifyUnique (lib/auth-utils): generazione slug univoco per i tenant.
 * - slugify base (lowercase, caratteri non alfanumerici → '-')
 * - input senza caratteri validi → fallback 'scuola'
 * - collisione → suffissi -2, -3, ... fino a -20
 * - oltre 20 tentativi → suffisso random base36 di 4 caratteri
 */

import { slugifyUnique } from '@/lib/auth-utils';

const neverExists = async (_slug: string) => false;

describe('slugifyUnique', () => {
  it("'Liceo Galilei' → 'liceo-galilei'", async () => {
    const slug = await slugifyUnique('Liceo Galilei', neverExists);
    expect(slug).toBe('liceo-galilei');
  });

  it('collisione sul base → suffisso -2', async () => {
    const exists = async (slug: string) => slug === 'liceo-galilei';
    const slug = await slugifyUnique('Liceo Galilei', exists);
    expect(slug).toBe('liceo-galilei-2');
  });

  it('collisioni su base e -2 → suffisso -3', async () => {
    const taken = new Set(['liceo-galilei', 'liceo-galilei-2']);
    const slug = await slugifyUnique('Liceo Galilei', async (s) => taken.has(s));
    expect(slug).toBe('liceo-galilei-3');
  });

  it("'***' (nessun carattere valido) → fallback non vuoto", async () => {
    const slug = await slugifyUnique('***', neverExists);
    expect(slug).toBe('scuola');
    expect(slug.length).toBeGreaterThan(0);
  });

  it('21 collisioni (base + -2..-20) → suffisso random base36 di 4 caratteri', async () => {
    // Occupa il base e tutti i suffissi numerici fino a -20
    const taken = new Set<string>(['liceo-galilei']);
    for (let i = 2; i <= 20; i++) taken.add(`liceo-galilei-${i}`);

    const slug = await slugifyUnique('Liceo Galilei', async (s) => taken.has(s));

    expect(taken.has(slug)).toBe(false);
    expect(slug).toMatch(/^liceo-galilei-[0-9a-z]{4}$/);
  });

  it('normalizza accenti/simboli senza doppi trattini né trattini ai bordi', async () => {
    const slug = await slugifyUnique('  Scuola -- Média & Arte!  ', neverExists);
    expect(slug).not.toMatch(/--|^-|-$/);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});
