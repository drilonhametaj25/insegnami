import { Metadata } from 'next';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { HomepageContent } from '@/components/public/HomepageContent';

export const metadata: Metadata = {
  title: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
  description:
    'Piattaforma all-in-one per scuole private, accademie e centri di formazione. Registro elettronico, gestione studenti, presenze digitali, pagamenti e comunicazioni scuola-famiglia.',
  keywords: [
    'registro elettronico',
    'gestione scolastica',
    'software scuola',
    'scuole private',
    'presenze digitali',
    'gestione studenti',
    'pagamenti scuola',
  ],
  openGraph: {
    title: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
    description:
      'Piattaforma all-in-one per scuole private, accademie e centri di formazione. Registro elettronico, presenze, pagamenti e comunicazioni.',
    type: 'website',
    url: 'https://insegnami.pro',
    siteName: 'InsegnaMi.pro',
    locale: 'it_IT',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
    description:
      'Piattaforma all-in-one per scuole private. Registro elettronico, presenze, pagamenti e comunicazioni.',
  },
  alternates: {
    languages: {
      'it': '/it',
      'en': '/en',
      'fr': '/fr',
      'pt': '/pt',
    },
  },
};

export default function LandingPage() {
  const locale = 'it';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'InsegnaMi.pro',
        description:
          'Piattaforma all-in-one per la gestione scolastica: registro elettronico, presenze, pagamenti e comunicazioni.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: 'https://insegnami.pro',
        offers: [
          {
            '@type': 'Offer',
            name: 'Starter',
            price: '29',
            priceCurrency: 'EUR',
            priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
          },
          {
            '@type': 'Offer',
            name: 'Professional',
            price: '59',
            priceCurrency: 'EUR',
            priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
          },
          {
            '@type': 'Offer',
            name: 'Enterprise',
            price: '199',
            priceCurrency: 'EUR',
            priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
          },
        ],
      },
      {
        '@type': 'Organization',
        name: 'InsegnaMi.pro',
        url: 'https://insegnami.pro',
        logo: 'https://insegnami.pro/logo.png',
      },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader locale={locale} />
      <main style={{ flex: 1 }}>
        <HomepageContent locale={locale} />
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
