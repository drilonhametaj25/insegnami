import { MetadataRoute } from 'next';
import { regioni, province, comuni, getComuneWithContext } from '@/data/italia';
import { getBlogSlugs } from '@/lib/blog';

const BASE_URL = 'https://insegnami.pro';
const LOCALES = ['it', 'en', 'fr', 'pt'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  // Static pages (per locale)
  const staticPages = [
    '',
    '/pricing',
    '/blog',
    '/tools',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/cookies',
    '/citta',
  ];

  for (const locale of LOCALES) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: now,
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : page === '/pricing' ? 0.9 : 0.7,
      });
    }
  }

  // Blog articles
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

  // City pages - Regions
  for (const locale of LOCALES) {
    for (const regione of regioni) {
      entries.push({
        url: `${BASE_URL}/${locale}/citta/${regione.slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  // City pages - Provinces
  for (const locale of LOCALES) {
    for (const prov of province) {
      const regione = regioni.find((r) => r.codice === prov.regione);
      if (regione) {
        entries.push({
          url: `${BASE_URL}/${locale}/citta/${regione.slug}/${prov.slug}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  }

  // City pages - Comuni
  for (const locale of LOCALES) {
    for (const comune of comuni) {
      const context = getComuneWithContext(comune.slug);
      if (context) {
        entries.push({
          url: `${BASE_URL}/${locale}/citta/${context.regione.slug}/${context.provincia.slug}/${comune.slug}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.4,
        });
      }
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

  for (const locale of LOCALES) {
    for (const tool of tools) {
      entries.push({
        url: `${BASE_URL}/${locale}/tools/${tool}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  // Auth pages (locale independent)
  entries.push({
    url: `${BASE_URL}/auth/login`,
    lastModified: now,
    changeFrequency: 'yearly',
    priority: 0.3,
  });

  entries.push({
    url: `${BASE_URL}/auth/register`,
    lastModified: now,
    changeFrequency: 'yearly',
    priority: 0.8,
  });

  return entries;
}
