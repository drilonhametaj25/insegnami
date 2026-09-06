/**
 * Parity test i18n: i quattro file messages/*.json devono avere ESATTAMENTE
 * lo stesso set di chiavi foglia. it.json è la lingua di riferimento: una
 * chiave presente solo in alcune lingue produce label grezze ('missing
 * message') a runtime, quindi il test fallisce elencando il diff esplicito.
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['it', 'en', 'fr', 'pt'] as const;
const MESSAGES_DIR = path.join(process.cwd(), 'messages');

type Messages = Record<string, unknown>;

function loadMessages(locale: string): Messages {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Messages;
}

/** Elenca i path "dotted" di tutte le foglie (stringhe/numeri) del JSON. */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix];
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  return entries.flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('i18n message parity', () => {
  const keySets = new Map<string, Set<string>>();

  beforeAll(() => {
    for (const locale of LOCALES) {
      keySets.set(locale, new Set(leafKeys(loadMessages(locale))));
    }
  });

  it.each(LOCALES.filter((l) => l !== 'it'))(
    '%s.json has the same leaf-key set as it.json',
    (locale) => {
      const it = keySets.get('it')!;
      const other = keySets.get(locale)!;

      const missing = [...it].filter((k) => !other.has(k)).sort();
      const extra = [...other].filter((k) => !it.has(k)).sort();

      const problems: string[] = [];
      if (missing.length > 0) {
        problems.push(
          `Chiavi presenti in it.json ma MANCANTI in ${locale}.json (${missing.length}):\n  - ${missing.join('\n  - ')}`
        );
      }
      if (extra.length > 0) {
        problems.push(
          `Chiavi presenti in ${locale}.json ma ASSENTI in it.json (${extra.length}):\n  - ${extra.join('\n  - ')}`
        );
      }

      if (problems.length > 0) {
        throw new Error(`Set di chiavi non allineato per ${locale}.json:\n\n${problems.join('\n\n')}`);
      }
    }
  );

  it('every locale has a non-empty message catalogue', () => {
    for (const locale of LOCALES) {
      expect(keySets.get(locale)!.size).toBeGreaterThan(0);
    }
  });
});
