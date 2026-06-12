import type { Metadata } from 'next';
import { faqJsonLd, type FaqItem } from '@/components/public/ToolPageShell';
import { CalcolatoreMediaVotiClient } from './CalcolatoreMediaVotiClient';

// FAQ condivise tra JSON-LD e accordion in pagina (testi invariati).
const faqs: FaqItem[] = [
  {
    question: 'Come funziona il calcolo della media pesata?',
    answer:
      'La media pesata tiene conto del "peso" di ogni voto. Ogni voto viene moltiplicato per il suo peso, poi si sommano tutti i risultati e si divide per la somma totale dei pesi. Questo permette di dare più importanza ad alcune valutazioni rispetto ad altre.',
  },
  {
    question: 'Quando usare pesi diversi per i voti?',
    answer:
      'I pesi diversi sono utili quando alcune valutazioni hanno più importanza di altre. Ad esempio, un compito in classe potrebbe avere peso 2, mentre un\'interrogazione peso 1. Oppure le materie principali potrebbero avere peso maggiore.',
  },
  {
    question: 'Come si calcola la media semplice?',
    answer:
      'Per calcolare la media semplice, imposta tutti i pesi a 1. In questo caso, tutti i voti avranno la stessa importanza e il risultato sarà la classica media aritmetica.',
  },
  {
    question: 'Posso salvare i miei calcoli?',
    answer:
      'Questo strumento gratuito non salva i dati. Per tenere traccia di tutti i voti dei tuoi studenti con calcolo automatico delle medie, prova InsegnaMi.pro gratuitamente per 14 giorni.',
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = 'Calcolatore Media Voti | Strumenti Gratuiti';
  const description =
    'Calcola gratis la media pesata dei voti scolastici: assegna un peso a compiti e interrogazioni e ottieni subito media e giudizio. Nessuna registrazione richiesta.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://insegnami.pro/${locale}/tools/calcolatore-media-voti`,
      siteName: 'InsegnaMi.pro',
    },
  };
}

export default async function CalcolatoreMediaVotiPage({
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
      <CalcolatoreMediaVotiClient locale={locale} faqs={faqs} />
    </>
  );
}
