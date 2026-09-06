import { getRequestConfig } from 'next-intl/server';

// Shared locale config (single source of truth for the [locale] segment)
export const locales = ['it', 'en', 'fr', 'pt'] as const;
export const defaultLocale = 'it';

export type AppLocale = (typeof locales)[number];

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (locales as readonly string[]).includes(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl v4: il locale del segmento (o l'override esplicito passato a
  // getTranslations({locale})) arriva via `requestLocale`. Può essere undefined
  // o non valido (il segmento [locale] fa da catch-all): fallback al default.
  const requested = await requestLocale;
  const locale = isAppLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
