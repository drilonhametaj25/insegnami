import type { Metadata } from 'next';
import { faqJsonLd, type FaqItem } from '@/components/public/ToolPageShell';
import { GeneratoreCalendarioClient } from './GeneratoreCalendarioClient';

// FAQ condivise tra JSON-LD e accordion in pagina (testi invariati).
const faqs: FaqItem[] = [
  {
    question: 'Quando inizia l\'anno scolastico in Italia?',
    answer:
      'L\'inizio dell\'anno scolastico varia per regione, generalmente tra il 5 e il 15 settembre. Ogni regione pubblica il proprio calendario scolastico con le date precise.',
  },
  {
    question: 'Quanti giorni di scuola ci sono in un anno?',
    answer:
      'La legge italiana prevede un minimo di 200 giorni di lezione per l\'anno scolastico. Alcune regioni possono prevedere qualche giorno in più per permettere maggiore flessibilità.',
  },
  {
    question: 'Quali sono le festività nazionali obbligatorie?',
    answer:
      'Le festività nazionali sempre incluse sono: Capodanno, Epifania, Pasqua e Lunedì dell\'Angelo, 25 Aprile, 1 Maggio, 2 Giugno, 15 Agosto, 1 Novembre, 8 Dicembre, Natale e Santo Stefano.',
  },
  {
    question: 'Posso personalizzare le festività regionali?',
    answer:
      'Questo generatore include le festività nazionali e le vacanze standard. Per personalizzazioni specifiche della tua regione o istituto, usa InsegnaMi.pro che permette di configurare un calendario completamente personalizzato.',
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = 'Generatore Calendario Scolastico | Strumenti Gratuiti';
  const description =
    'Genera gratis il calendario scolastico con festività nazionali, vacanze di Natale e Pasqua e conteggio dei giorni di lezione. Verifica subito il requisito dei 200 giorni.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://insegnami.pro/${locale}/tools/generatore-calendario-scolastico`,
      siteName: 'InsegnaMi.pro',
    },
  };
}

export default async function GeneratoreCalendarioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
      />
      <GeneratoreCalendarioClient locale={locale} faqs={faqs} />
    </>
  );
}
