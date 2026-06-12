import { Metadata } from 'next';
import { faqJsonLd, type FaqItem } from '@/components/public/ToolPageShell';
import { GeneratoreOrarioClient } from './GeneratoreOrarioClient';

export const metadata: Metadata = {
  title: 'Generatore Orario Settimanale | Strumenti Gratuiti',
  description:
    'Crea gratis l\'orario settimanale delle lezioni della tua classe: materie, docenti, aule e colori personalizzati con anteprima pronta da stampare.',
  openGraph: {
    title: 'Generatore Orario Settimanale | Strumenti Gratuiti | InsegnaMi.pro',
    description:
      'Crea l\'orario settimanale delle lezioni con materie, docenti, aule e colori personalizzati. Anteprima pronta da stampare.',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  {
    question: 'Come creo un orario efficace?',
    answer:
      'Per un orario efficace, alterna materie teoriche e pratiche, evita di mettere le materie più impegnative dopo pranzo, considera le esigenze dei docenti e degli spazi. Prevedi pause adeguate tra le lezioni.',
  },
  {
    question: 'Posso esportare l\'orario?',
    answer:
      'Questo strumento gratuito genera una visualizzazione dell\'orario. Per funzionalità avanzate come esportazione PDF, sincronizzazione con calendari e notifiche automatiche, usa InsegnaMi.pro.',
  },
  {
    question: 'Come gestisco i conflitti di orario?',
    answer:
      'Un conflitto si verifica quando lo stesso docente o aula è assegnato a più lezioni nello stesso orario. Questo strumento non verifica automaticamente i conflitti - InsegnaMi.pro include la verifica automatica.',
  },
  {
    question: 'Quante ore settimanali sono tipiche?',
    answer:
      'Nella scuola italiana: primaria 24-27 ore, secondaria I grado 30 ore, secondaria II grado 27-35 ore. Le scuole private possono avere orari personalizzati in base al programma.',
  },
];

export default async function GeneratoreOrarioPage({
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
      <GeneratoreOrarioClient locale={locale} faqs={faqs} />
    </>
  );
}
