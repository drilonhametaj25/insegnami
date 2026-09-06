import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HomepageContent } from '@/components/public/HomepageContent';
import { getPublicPlans } from '@/lib/billing/public-plans';
import { softwareApplicationJsonLd } from '@/lib/structured-data';
import { buildPublicMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.home.meta' });

  const title = t('title');
  const description = t('description');

  // canonical self + hreflang assoluti + x-default + og:image dal helper
  // condiviso: la homepage segue le stesse regole di ogni pagina pubblica.
  const base = buildPublicMetadata({ locale, path: '/', title, description });

  return {
    ...base,
    title: { absolute: title },
  };
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Stessa fonte server-side di /pricing: le due vetrine non possono divergere
  const plans = await getPublicPlans();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
      />
      <HomepageContent locale={locale} plans={plans} />
    </>
  );
}
