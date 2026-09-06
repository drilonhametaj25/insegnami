import type { Metadata } from 'next';
import { faqJsonLd, toolPageMetadata, type FaqItem } from '@/components/public/ToolPageShell';
import { GeneratoreComunicazioniClient } from './GeneratoreComunicazioniClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...toolPageMetadata({
      locale,
      slug: 'generatore-comunicazioni',
      title: 'Generatore Comunicazioni | Strumenti Gratuiti',
      description:
        'Template gratuiti per comunicazioni scuola-famiglia: assenze, solleciti di pagamento, riunioni, valutazioni e avvisi. Personalizza i campi e copia il testo pronto da inviare.',
    }),
    keywords: [
      'template comunicazioni scuola',
      'comunicazioni scuola famiglia',
      'circolari scolastiche',
      'avvisi genitori',
      'lettere scuola genitori',
    ],
  };
}

const faqs: FaqItem[] = [
  {
    question: 'Posso personalizzare i template?',
    answer:
      'Sì, puoi modificare i valori delle variabili per adattare il messaggio. Per template completamente personalizzati e salvataggio, usa InsegnaMi.pro.',
  },
  {
    question: 'Come invio la comunicazione?',
    answer:
      'Questo strumento genera il testo. Puoi copiarlo e incollarlo nella tua email o sistema di messaggistica. InsegnaMi.pro invia automaticamente le comunicazioni.',
  },
  {
    question: 'Posso inviare comunicazioni di massa?',
    answer:
      'Con questo strumento puoi generare un messaggio alla volta. Per invii massivi a tutti i genitori o classi specifiche, InsegnaMi.pro gestisce tutto automaticamente.',
  },
  {
    question: 'Le comunicazioni sono conformi al GDPR?',
    answer:
      'I template sono generici. Assicurati di rispettare la privacy e di avere il consenso per le comunicazioni. InsegnaMi.pro include la gestione completa del consenso GDPR.',
  },
];

export default async function GeneratoreComunicazioniPage({
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
      <GeneratoreComunicazioniClient locale={locale} faqs={faqs} />
    </>
  );
}
