import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n';
import { AppProviders } from '@/components/providers/AppProviders';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Il segmento [locale] fa da catch-all: 404 per valori non supportati
  if (!isAppLocale(locale)) notFound();

  // Fissa il locale per le API server di next-intl (getMessages/getTranslations)
  setRequestLocale(locale);

  // Messaggi risolti lato server: niente useEffect né flash di chiavi non tradotte
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppProviders>
        <div data-locale={locale}>{children}</div>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
