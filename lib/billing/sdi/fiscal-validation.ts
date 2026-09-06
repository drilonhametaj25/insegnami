/**
 * Validazione fiscale pre-emissione/trasmissione FatturaPA.
 *
 * Funzione PURA: raccoglie l'elenco dei problemi bloccanti (SDI scarterebbe
 * il file) così le route /issue e /transmit possono rispondere 422 con la
 * lista dei campi mancanti PRIMA di consumare un numero di fattura o una
 * trasmissione al provider.
 */

export type FiscalLineInput = {
  lineNumber: number;
  vatRate: unknown;
  vatNature?: string | null;
};

export type FiscalCustomerInput = {
  codiceFiscale?: string | null;
  partitaIva?: string | null;
  cap: string;
  nazione?: string | null;
  codiceDestinatario?: string | null;
  pec?: string | null;
};

export function validateInvoiceFiscalData(input: {
  lines: FiscalLineInput[];
  customer: FiscalCustomerInput;
}): string[] {
  const problems: string[] = [];
  const { lines, customer } = input;

  // Righe esenti/fuori campo: aliquota 0 richiede la Natura (N1..N7).
  for (const line of lines) {
    if (Number(line.vatRate) === 0 && !line.vatNature) {
      problems.push(`Riga ${line.lineNumber}: aliquota IVA 0 senza Natura esenzione (N1–N7)`);
    }
  }

  // Identificazione fiscale del cessionario: almeno uno tra CF e P.IVA.
  const hasCf = Boolean(customer.codiceFiscale?.trim());
  const hasPiva = Boolean(customer.partitaIva?.trim());
  if (!hasCf && !hasPiva) {
    problems.push('Cliente senza codice fiscale né partita IVA');
  }

  // CAP italiano: 5 cifre.
  const nazione = (customer.nazione ?? 'IT').toUpperCase();
  if (nazione === 'IT' && !/^\d{5}$/.test(customer.cap ?? '')) {
    problems.push('CAP del cliente non valido (attese 5 cifre)');
  }

  // Recapito SDI: codiceDestinatario di 7 char (privati, '0000000' incluso)
  // o 6 char (uffici PA). Se non valido serve almeno la PEC.
  const cd = customer.codiceDestinatario ?? '';
  const cdValido = cd.length === 7 || cd.length === 6;
  if (!cdValido && !customer.pec?.trim()) {
    problems.push('Codice destinatario non valido (7 caratteri, 6 per PA) e nessuna PEC indicata');
  }

  return problems;
}
