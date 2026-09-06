import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildPublicMetadata } from '@/lib/seo';
import { faqPageJsonLd } from '@/lib/structured-data';
import { getPublicPlans } from '@/lib/billing/public-plans';
import { PricingContent, type PricingFaqItem } from '@/components/public/PricingContent';

/**
 * Pagina /pricing SERVER: metadata SEO + piani letti server-side con
 * getPublicPlans() (stessa fonte della homepage) così i PREZZI stanno
 * nell'HTML iniziale. L'interattività vive nel client island PricingContent.
 * Testi in messages/*.json sotto public.pricing.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.pricing.meta' });
  const title = t('title');
  return {
    ...buildPublicMetadata({
      locale,
      path: '/pricing',
      title,
      description: t('description'),
    }),
    // Il brand è già nel titolo: absolute evita il doppio "| InsegnaMi.pro"
    // del template di app/layout.tsx.
    title: { absolute: title },
  };
}

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  // Piano preselezionato dai query param (?plan=slug): letto server-side così
  // il client island non ha bisogno di useSearchParams (niente CSR bailout).
  const preselectedPlan = typeof sp.plan === 'string' ? sp.plan : null;
  const plans = await getPublicPlans();

  // FAQ condivise tra JSON-LD (FAQPage) e accordion in pagina (testi invariati).
  const t = await getTranslations({ locale, namespace: 'public.pricing' });
  const faqItems = t.raw('faqs') as PricingFaqItem[];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(faqItems)) }}
      />
      <PricingContent
        plans={plans}
        locale={locale}
        preselectedPlan={preselectedPlan}
        faqs={faqItems}
      />
    </>
  );
}
