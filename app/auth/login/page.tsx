import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

const SUPPORTED_LOCALES = ['it', 'en', 'fr', 'pt'];
const DEFAULT_LOCALE = 'it';

function getLocaleFromHeaders(acceptLanguage: string | null): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const preferred = acceptLanguage.split(',').map(l => l.split(';')[0].trim().substring(0, 2));
  return preferred.find(l => SUPPORTED_LOCALES.includes(l)) || DEFAULT_LOCALE;
}

export default async function LoginRedirect() {
  const headersList = await headers();
  const locale = getLocaleFromHeaders(headersList.get('accept-language'));
  redirect(`/${locale}/auth/login`);
}
