import { Metadata } from 'next';
import { faqJsonLd, type FaqItem } from '@/components/public/ToolPageShell';
import { CalcolatoreOreCorsoClient } from './CalcolatoreOreCorsoClient';

export const metadata: Metadata = {
  title: 'Calcolatore Ore Corso | Strumenti Gratuiti',
  description:
    'Calcola gratis il totale delle ore di un corso, il numero di lezioni necessarie e la data di fine: pianificazione settimanale automatica per scuole e centri di formazione.',
  openGraph: {
    title: 'Calcolatore Ore Corso | Strumenti Gratuiti | InsegnaMi.pro',
    description:
      'Calcola il totale delle ore di un corso, il numero di lezioni necessarie e la data di fine con la pianificazione settimanale automatica.',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  {
    question: 'Come calcolo le ore necessarie per un corso?',
    answer:
      'Le ore di un corso dipendono dagli obiettivi formativi. Per certificazioni linguistiche: A1=80-100h, A2=180-200h, B1=350-400h, B2=500-600h. Per corsi musicali: base 30-40h/anno, intermedio 40-60h/anno.',
  },
  {
    question: 'Qual è la durata ideale di una lezione?',
    answer:
      'Dipende dall\'età e dal tipo di corso. Per bambini: 30-45 minuti. Per ragazzi: 45-60 minuti. Per adulti: 60-120 minuti. Per corsi intensivi: fino a 3-4 ore con pause.',
  },
  {
    question: 'Quante lezioni a settimana sono consigliate?',
    answer:
      'Per corsi standard: 1-2 lezioni/settimana. Per corsi intensivi: 3-5 lezioni/settimana. Più di 5 lezioni può portare a sovraccarico e ridurre l\'efficacia dell\'apprendimento.',
  },
  {
    question: 'Come gestisco le assenze e i recuperi?',
    answer:
      'È consigliabile prevedere un 10-15% di ore extra per recuperi. InsegnaMi.pro gestisce automaticamente le assenze e pianifica le lezioni di recupero.',
  },
];

export default async function CalcolatoreOreCorsoPage({
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
      <CalcolatoreOreCorsoClient locale={locale} faqs={faqs} />
    </>
  );
}
