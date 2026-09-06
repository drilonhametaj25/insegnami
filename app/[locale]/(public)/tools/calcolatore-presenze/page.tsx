import type { Metadata } from 'next';
import { faqJsonLd, toolPageMetadata, type FaqItem } from '@/components/public/ToolPageShell';
import { CalcolatorePresenzeClient } from './CalcolatorePresenzeClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...toolPageMetadata({
      locale,
      slug: 'calcolatore-presenze',
      title: 'Calcolatore Presenze | Strumenti Gratuiti',
      description:
        'Calcola gratis la percentuale di frequenza scolastica e verifica il raggiungimento del monte ore minimo (75%) previsto dal D.P.R. 122/2009. Per scuole, docenti e famiglie.',
    }),
    keywords: [
      'calcolatore presenze scolastiche',
      'percentuale frequenza scuola',
      'monte ore minimo 75%',
      'validità anno scolastico',
      'calcolo assenze scuola',
    ],
  };
}

const faqs: FaqItem[] = [
  {
    question: 'Qual è il minimo di presenze richiesto per legge?',
    answer:
      'In Italia, per la validità dell\'anno scolastico, è richiesta la frequenza di almeno il 75% del monte ore annuale personalizzato. Questo significa che uno studente può assentarsi al massimo per il 25% delle ore.',
  },
  {
    question: 'Come si calcola il monte ore annuale?',
    answer:
      'Il monte ore annuale si calcola moltiplicando le ore settimanali per il numero di settimane di scuola (solitamente 33-35 settimane). Ad esempio: 30 ore/settimana × 33 settimane = 990 ore annuali.',
  },
  {
    question: 'Le assenze giustificate contano nel calcolo?',
    answer:
      'Sì, anche le assenze giustificate vengono conteggiate nel monte ore di assenza. Tuttavia, alcune assenze possono essere escluse dal computo, come quelle per motivi di salute documentati, partecipazione ad attività sportive agonistiche, o altri motivi previsti dal regolamento scolastico.',
  },
  {
    question: 'Cosa succede se non si raggiunge il minimo?',
    answer:
      'Se lo studente non raggiunge il 75% di frequenza, il Consiglio di Classe deve deliberare sulla validità dell\'anno scolastico. In alcuni casi, possono essere concesse deroghe per motivi documentati.',
  },
];

export default async function CalcolatorePresenzePage({
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
      <CalcolatorePresenzeClient locale={locale} faqs={faqs} />
    </>
  );
}
