import { Metadata } from 'next';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { HomepageContent } from '@/components/public/HomepageContent';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    it: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
    en: 'InsegnaMi.pro — Electronic Register & School Management',
    fr: 'InsegnaMi.pro — Registre Électronique et Gestion Scolaire',
    pt: 'InsegnaMi.pro — Registro Eletrônico e Gestão Escolar',
  };

  const descriptions: Record<string, string> = {
    it: 'Piattaforma all-in-one per scuole private, accademie e centri di formazione. Registro elettronico, presenze, pagamenti e comunicazioni.',
    en: 'All-in-one platform for private schools, academies and training centers. Electronic register, attendance, payments and communications.',
    fr: 'Plateforme tout-en-un pour écoles privées, académies et centres de formation. Registre électronique, présences, paiements et communications.',
    pt: 'Plataforma completa para escolas particulares, academias e centros de formação. Registro eletrônico, presenças, pagamentos e comunicações.',
  };

  return {
    title: titles[locale] || titles.it,
    description: descriptions[locale] || descriptions.it,
    openGraph: {
      title: titles[locale] || titles.it,
      description: descriptions[locale] || descriptions.it,
      type: 'website',
      url: `https://insegnami.pro/${locale}`,
      siteName: 'InsegnaMi.pro',
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
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader locale={locale} />
      <main style={{ flex: 1 }}>
        <HomepageContent locale={locale} />
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
