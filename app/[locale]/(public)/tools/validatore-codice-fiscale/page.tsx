import type { Metadata } from 'next';
import { faqJsonLd, type FaqItem } from '@/components/public/ToolPageShell';
import { ValidatoreCodiceFiscaleClient } from './ValidatoreCodiceFiscaleClient';

export const metadata: Metadata = {
  title: 'Validatore Codice Fiscale | Strumenti Gratuiti',
  description:
    'Verifica gratis la correttezza formale di un codice fiscale italiano: formato, carattere di controllo, data di nascita e sesso. Utile per segreterie scolastiche e iscrizioni.',
  keywords: [
    'validatore codice fiscale',
    'verifica codice fiscale',
    'controllo codice fiscale online',
    'carattere di controllo codice fiscale',
    'codice fiscale italiano',
  ],
  openGraph: {
    title: 'Validatore Codice Fiscale | Strumenti Gratuiti | InsegnaMi.pro',
    description:
      'Verifica la correttezza formale di un codice fiscale italiano ed estrai le informazioni anagrafiche. Gratuito, senza registrazione.',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  {
    question: 'Come è composto il codice fiscale?',
    answer:
      'Il codice fiscale italiano è composto da 16 caratteri: 3 lettere per il cognome, 3 per il nome, 2 cifre per l\'anno di nascita, 1 lettera per il mese, 2 cifre per il giorno (per le donne si aggiunge 40), 4 caratteri per il comune di nascita (o stato estero), e 1 carattere di controllo.',
  },
  {
    question: 'Cosa significa il carattere di controllo?',
    answer:
      'L\'ultimo carattere del codice fiscale è un carattere di controllo calcolato con un algoritmo specifico sui primi 15 caratteri. Serve a verificare che il codice non contenga errori di trascrizione.',
  },
  {
    question: 'Perché il giorno di nascita può essere superiore a 31?',
    answer:
      'Per le persone di sesso femminile, al giorno di nascita viene sommato 40. Quindi se una donna è nata il 15 del mese, nel codice fiscale apparirà 55.',
  },
  {
    question: 'Questo strumento verifica l\'esistenza del codice fiscale?',
    answer:
      'No, questo strumento verifica solo la correttezza formale del codice fiscale (formato e carattere di controllo). Non verifica se il codice fiscale è effettivamente assegnato a una persona.',
  },
];

export default async function ValidatoreCodiceFiscalePage({
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
      <ValidatoreCodiceFiscaleClient locale={locale} faqs={faqs} />
    </>
  );
}
