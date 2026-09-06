import { PLAN_CATALOG } from '@/lib/billing/plans-catalog';
import { SITE_URL } from '@/lib/seo';

/**
 * Builder JSON-LD centralizzati per le pagine pubbliche.
 * Ogni pagina inietta il proprio blocco con:
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(x)}} />
 */

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'InsegnaMi.pro',
        description:
          'Piattaforma all-in-one per la gestione scolastica: registro elettronico, presenze, pagamenti e comunicazioni.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: SITE_URL,
        offers: PLAN_CATALOG.map((plan) => ({
          '@type': 'Offer',
          name: plan.name,
          price: String(plan.price),
          priceCurrency: 'EUR',
          priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
        })),
      },
      organizationJsonLd(),
    ],
  };
}

export function organizationJsonLd() {
  return {
    '@type': 'Organization',
    name: 'InsegnaMi.pro',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.svg`,
  };
}

export function faqPageJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
