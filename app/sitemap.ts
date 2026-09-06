import { MetadataRoute } from 'next';
import { regioni, province, comuni, getComuneWithContext } from '@/data/italia';
import { getBlogSlugs } from '@/lib/blog';

const BASE_URL = 'https://insegnami.pro';
const LOCALES = ['it', 'en', 'fr', 'pt'];

/**
 * Voce sitemap con hreflang: le 4 versioni linguistiche sono presentate come
 * traduzioni della stessa pagina (x-default → it), non come URL indipendenti.
 */
function localizedEntry(
  path: string,
  opts: { lastModified: Date; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number; locales?: string[] }
): MetadataRoute.Sitemap {
  const locales = opts.locales ?? LOCALES;
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [l, `${BASE_URL}/${l}${path}`])
  );
  if (locales.includes('it')) languages['x-default'] = `${BASE_URL}/it${path}`;

  return locales.map((locale) => ({
    url: `${BASE_URL}/${locale}${path}`,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  // Static pages (per locale, con hreflang)
  const staticPages = [
    '',
    '/pricing',
    '/blog',
    '/tools',
    '/contact',
    '/privacy',
    '/terms',
    '/cookies',
    '/citta',
  ];

  for (const page of staticPages) {
    entries.push(
      ...localizedEntry(page, {
        lastModified: now,
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : page === '/pricing' ? 0.9 : 0.7,
      })
    );
  }

  // Blog articles — SOLO per i locali che hanno davvero il post
  for (const locale of LOCALES) {
    try {
      const slugs = await getBlogSlugs(locale);
      for (const slug of slugs) {
        entries.push({
          url: `${BASE_URL}/${locale}/blog/${slug}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    } catch {
      // Blog folder might not exist for all locales
    }
  }

  // Pagine città: si pubblicano SOLO i livelli con contenuto reale
  // (regioni con almeno una provincia popolata, province con almeno un
  // comune): le pagine "In arrivo" restano fuori dall'indice.
  const provinceWithComuni = new Set(comuni.map((c) => c.provincia));
  const regioniWithProvince = new Set(
    province.filter((p) => provinceWithComuni.has(p.codice)).map((p) => p.regione)
  );

  for (const regione of regioni) {
    if (!regioniWithProvince.has(regione.codice)) continue;
    entries.push(
      ...localizedEntry(`/citta/${regione.slug}`, {
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    );
  }

  for (const prov of province) {
    if (!provinceWithComuni.has(prov.codice)) continue;
    const regione = regioni.find((r) => r.codice === prov.regione);
    if (regione) {
      entries.push(
        ...localizedEntry(`/citta/${regione.slug}/${prov.slug}`, {
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      );
    }
  }

  for (const comune of comuni) {
    const context = getComuneWithContext(comune.slug);
    if (context) {
      entries.push(
        ...localizedEntry(
          `/citta/${context.regione.slug}/${context.provincia.slug}/${comune.slug}`,
          { lastModified: now, changeFrequency: 'monthly', priority: 0.4 }
        )
      );
    }
  }

  // Tools pages
  const tools = [
    'calcolatore-media-voti',
    'calcolatore-presenze',
    'calcolatore-costo-studente',
    'calcolatore-ore-corso',
    'validatore-codice-fiscale',
    'generatore-calendario-scolastico',
    'generatore-orario-settimanale',
    'generatore-comunicazioni',
  ];

  for (const tool of tools) {
    entries.push(
      ...localizedEntry(`/tools/${tool}`, {
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      })
    );
  }

  // NB: niente URL /auth/* senza prefisso locale (il middleware li 307a):
  // la registrazione è raggiungibile dalle CTA, non serve in sitemap.

  return entries;
}
