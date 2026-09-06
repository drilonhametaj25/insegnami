import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildPublicMetadata } from '@/lib/seo';
import { faqPageJsonLd } from '@/lib/structured-data';
import { ContactContent, type ContactFaqItem } from '@/components/public/ContactContent';

/**
 * Pagina /contact SERVER: metadata SEO + oggetto precompilato letto dai query
 * param lato server. Il form (con anti-spam honeypot + startedAt) vive nel
 * client island ContactContent. Testi in messages/*.json sotto public.contact.
 */

// Mappa ?subject=... → chiave del messaggio in public.contact.subjects
const SUBJECT_KEYS: Record<string, 'enterprise' | 'fullInstallation' | 'demo' | 'support'> = {
  'enterprise': 'enterprise',
  'full-installation': 'fullInstallation',
  'demo': 'demo',
  'support': 'support',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.contact.meta' });
  const title = t('title');
  return {
    ...buildPublicMetadata({
      locale,
      path: '/contact',
      title,
      description: t('description'),
    }),
    // Il brand è già nel titolo: absolute evita il doppio "| InsegnaMi.pro"
    // del template di app/layout.tsx.
    title: { absolute: title },
  };
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: 'public.contact' });

  const subjectParam = typeof sp.subject === 'string' ? sp.subject : null;
  const subjectKey = subjectParam ? SUBJECT_KEYS[subjectParam] ?? null : null;
  const initialSubject = subjectKey ? t(`subjects.${subjectKey}`) : null;

  // FAQ condivise tra JSON-LD (FAQPage) e accordion in pagina (testi invariati).
  const faqItems = t.raw('faqs') as ContactFaqItem[];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(faqItems)) }}
      />
      <ContactContent locale={locale} initialSubject={initialSubject} faqs={faqItems} />
    </>
  );
}
