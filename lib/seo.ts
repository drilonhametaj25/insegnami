import type { Metadata } from 'next';

/**
 * Helper SEO per le pagine pubbliche: canonical self-referente assoluto,
 * hreflang per i 4 locali + x-default (→ it), OpenGraph/Twitter coerenti.
 *
 * Uso (in generateMetadata di una pagina server):
 *   return buildPublicMetadata({ locale, path: '/pricing', title, description });
 */

export const SITE_URL = 'https://insegnami.pro';
export const PUBLIC_LOCALES = ['it', 'en', 'fr', 'pt'] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export function buildPublicMetadata({
  locale,
  path,
  title,
  description,
  ogImage,
  noindex = false,
}: {
  locale: string;
  /** Path SENZA prefisso locale, con slash iniziale ('' o '/' = homepage). */
  path: string;
  title: string;
  description: string;
  ogImage?: string;
  noindex?: boolean;
}): Metadata {
  const cleanPath = path === '/' ? '' : path;
  const canonical = `${SITE_URL}/${locale}${cleanPath}`;
  const languages: Record<string, string> = Object.fromEntries(
    PUBLIC_LOCALES.map((l) => [l, `${SITE_URL}/${l}${cleanPath}`])
  );
  languages['x-default'] = `${SITE_URL}/it${cleanPath}`;

  const image = ogImage ?? `${SITE_URL}/og-default.png`;

  return {
    title,
    description,
    alternates: { canonical, languages },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'InsegnaMi.pro',
      type: 'website',
      locale: locale === 'it' ? 'it_IT' : locale,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
