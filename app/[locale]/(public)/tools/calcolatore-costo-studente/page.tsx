import type { Metadata } from 'next';
import { faqJsonLd, type FaqItem } from '@/components/public/ToolPageShell';
import { CalcolatoreCostoStudenteClient } from './CalcolatoreCostoStudenteClient';

// FAQ condivise tra JSON-LD e accordion in pagina (testi invariati).
const faqs: FaqItem[] = [
  {
    question: 'Quali costi devo includere nel calcolo?',
    answer:
      'Dovresti includere tutti i costi fissi e variabili della scuola: affitto, stipendi, utenze, materiali, assicurazioni, manutenzione, marketing, software, consulenze, tasse. Non dimenticare i costi nascosti come ammortamenti e imprevisti.',
  },
  {
    question: 'Come uso questo dato per stabilire le rette?',
    answer:
      'Il costo per studente è il tuo "punto di pareggio". Per avere un margine, la retta dovrebbe essere superiore a questo valore. Un margine del 15-25% è tipico per le scuole private, considerando anche un tasso di occupazione non al 100%.',
  },
  {
    question: 'Devo considerare studenti a tempo pieno e part-time diversamente?',
    answer:
      'Sì, è consigliabile calcolare gli studenti in "equivalenti a tempo pieno" (FTE). Ad esempio, uno studente part-time al 50% conta come 0.5 FTE. Questo dà un costo per studente più accurato.',
  },
  {
    question: 'Con quale frequenza dovrei rifare questo calcolo?',
    answer:
      'È consigliabile rifare il calcolo almeno una volta all\'anno o quando ci sono cambiamenti significativi nei costi o nel numero di studenti. InsegnaMi.pro può calcolare automaticamente questi dati in tempo reale.',
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = 'Calcolatore Costo per Studente | Strumenti Gratuiti';
  const description =
    'Calcola gratis il costo annuale e mensile per studente della tua scuola: inserisci le voci di spesa e ottieni ripartizione dei costi e retta consigliata. Nessuna registrazione.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://insegnami.pro/${locale}/tools/calcolatore-costo-studente`,
      siteName: 'InsegnaMi.pro',
    },
  };
}

export default async function CalcolatoreCostoStudentePage({
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
      <CalcolatoreCostoStudenteClient locale={locale} faqs={faqs} />
    </>
  );
}
