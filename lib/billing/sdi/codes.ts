/**
 * Codici tabellari della specifica FatturaPA versione 1.7 (AdE).
 * Manteniamo qui sia gli enum stringa che le label IT per la UI —
 * questi valori cambiano raramente ma quando cambiano va aggiornata
 * questa fonte unica.
 *
 * Riferimento: provvedimento Agenzia delle Entrate n. 89757/2018
 * + aggiornamenti specifica tecnica fattura elettronica.
 */

// ---- Tipo Documento (TipoDocumento) ----
export const TIPO_DOCUMENTO = {
  TD01: 'Fattura',
  TD02: 'Acconto/anticipo su fattura',
  TD03: 'Acconto/anticipo su parcella',
  TD04: 'Nota di Credito',
  TD05: 'Nota di Debito',
  TD06: 'Parcella',
  TD16: 'Integrazione fattura reverse charge interno',
  TD17: 'Integrazione/autofattura per acquisto servizi dall\'estero',
  TD18: 'Integrazione per acquisto beni intracomunitari',
  TD19: 'Integrazione/autofattura per acquisto beni ex art.17 c.2 DPR 633/72',
  TD20: 'Autofattura per regolarizzazione e integrazione delle fatture',
  TD21: 'Autofattura per splafonamento',
  TD22: 'Estrazione beni da Deposito IVA',
  TD23: 'Estrazione beni da Deposito IVA con versamento dell\'IVA',
  TD24: 'Fattura differita di cui all\'art.21 c.4 lett. a)',
  TD25: 'Fattura differita di cui all\'art.21 c.4 terzo periodo lett. b)',
  TD26: 'Cessione di beni ammortizzabili e per passaggi interni',
  TD27: 'Fattura per autoconsumo o per cessioni gratuite senza rivalsa',
  TD28: 'Acquisti da San Marino con IVA (fattura cartacea)',
} as const;
export type TipoDocumentoCode = keyof typeof TIPO_DOCUMENTO;

// ---- Regime Fiscale (RegimeFiscale del cedente prestatore) ----
export const REGIME_FISCALE = {
  RF01: 'Ordinario',
  RF02: 'Contribuenti minimi (art.1, c.96-117, L.244/2007)',
  RF04: 'Agricoltura e attività connesse e pesca (artt.34 e 34-bis, DPR 633/72)',
  RF05: 'Vendita sali e tabacchi (art.74, c.1, DPR 633/72)',
  RF06: 'Commercio fiammiferi (art.74, c.1, DPR 633/72)',
  RF07: 'Editoria (art.74, c.1, DPR 633/72)',
  RF08: 'Gestione servizi telefonia pubblica (art.74, c.1, DPR 633/72)',
  RF09: 'Rivendita documenti di trasporto pubblico e di sosta (art.74, c.1, DPR 633/72)',
  RF10: 'Intrattenimenti, giochi e altre attività di cui alla tariffa allegata al DPR 640/72',
  RF11: 'Agenzie viaggi e turismo (art.74-ter, DPR 633/72)',
  RF12: 'Agriturismo (art.5, c.2, L. 413/91)',
  RF13: 'Vendite a domicilio (art.25-bis, c.6, DPR 600/73)',
  RF14: 'Rivendita beni usati, oggetti d\'arte (art.36, DL 41/95)',
  RF15: 'Agenzie di vendite all\'asta di oggetti d\'arte (art.40-bis, DL 41/95)',
  RF16: 'IVA per cassa P.A. (art.6, c.5, DPR 633/72)',
  RF17: 'IVA per cassa (art. 32-bis, DL 83/2012)',
  RF18: 'Altro',
  RF19: 'Regime forfettario (art.1, c.54-89, L. 190/2014)',
} as const;
export type RegimeFiscaleCode = keyof typeof REGIME_FISCALE;

// ---- Natura IVA (per righe con aliquota 0%) ----
// Obbligatorio quando ImponibileImporto è soggetto a un regime diverso da
// "ordinario" (esente, non imponibile, fuori campo, reverse charge, ecc.).
export const NATURA_IVA = {
  N1:    'Escluse ex art.15 del DPR 633/72',
  N2:    'Non soggette',
  'N2.1': 'Non soggette ad IVA artt. da 7 a 7-septies del DPR 633/72',
  'N2.2': 'Non soggette - altri casi',
  N3:    'Non imponibili',
  'N3.1': 'Non imponibili - esportazioni',
  'N3.2': 'Non imponibili - cessioni intracomunitarie',
  'N3.3': 'Non imponibili - cessioni verso San Marino',
  'N3.4': 'Non imponibili - operazioni assimilate alle cessioni all\'esportazione',
  'N3.5': 'Non imponibili - a seguito di dichiarazioni d\'intento',
  'N3.6': 'Non imponibili - altre operazioni che non concorrono alla formazione del plafond',
  N4:    'Esenti',
  N5:    'Regime del margine / IVA non esposta in fattura',
  N6:    'Inversione contabile (per le operazioni in reverse charge)',
  'N6.1': 'Inversione contabile - cessione di rottami e altri materiali di recupero',
  'N6.2': 'Inversione contabile - cessione di oro e argento puro',
  'N6.3': 'Inversione contabile - subappalto nel settore edile',
  'N6.4': 'Inversione contabile - cessione di fabbricati',
  'N6.5': 'Inversione contabile - cessione di telefoni cellulari',
  'N6.6': 'Inversione contabile - cessione di prodotti elettronici',
  'N6.7': 'Inversione contabile - prestazioni comparto edile e settori connessi',
  'N6.8': 'Inversione contabile - operazioni settore energetico',
  'N6.9': 'Inversione contabile - altri casi',
  N7:    'IVA assolta in altro stato UE',
} as const;
export type NaturaIvaCode = keyof typeof NATURA_IVA;

// ---- Modalità Pagamento ----
export const MODALITA_PAGAMENTO = {
  MP01: 'Contanti',
  MP02: 'Assegno',
  MP03: 'Assegno circolare',
  MP04: 'Contanti presso Tesoreria',
  MP05: 'Bonifico',
  MP06: 'Vaglia cambiario',
  MP07: 'Bollettino bancario',
  MP08: 'Carta di pagamento',
  MP09: 'RID',
  MP10: 'RID utenze',
  MP11: 'RID veloce',
  MP12: 'RIBA',
  MP13: 'MAV',
  MP14: 'Quietanza erario',
  MP15: 'Giroconto su conti di contabilità speciale',
  MP16: 'Domiciliazione bancaria',
  MP17: 'Domiciliazione postale',
  MP18: 'Bollettino di c/c postale',
  MP19: 'SEPA Direct Debit',
  MP20: 'SEPA Direct Debit CORE',
  MP21: 'SEPA Direct Debit B2B',
  MP22: 'Trattenuta su somme già riscosse',
  MP23: 'PagoPA',
} as const;
export type ModalitaPagamentoCode = keyof typeof MODALITA_PAGAMENTO;

// ---- Condizioni di Pagamento ----
export const CONDIZIONI_PAGAMENTO = {
  TP01: 'Pagamento a rate',
  TP02: 'Pagamento completo',
  TP03: 'Anticipo',
} as const;
export type CondizioniPagamentoCode = keyof typeof CONDIZIONI_PAGAMENTO;

// ---- Format trasmissione ----
// FPR12 = Fattura tra Privati (B2B/B2C), FPA12 = verso Pubblica Amministrazione.
export const FORMATO_TRASMISSIONE = {
  FPR12: 'Fattura B2B/B2C (privati)',
  FPA12: 'Fattura verso Pubblica Amministrazione',
} as const;
export type FormatoTrasmissioneCode = keyof typeof FORMATO_TRASMISSIONE;

// ---- Helper validators ----
/** Valida un Codice Destinatario SDI. 7 caratteri alfanumerici, "0000000" = recapito via PEC, "XXXXXXX" = estero. */
export function isValidCodiceDestinatario(code: string): boolean {
  return /^[A-Z0-9]{7}$/.test(code);
}

/** Valida una Partita IVA italiana. 11 cifre + checksum Luhn-like. */
export function isValidPartitaIva(piva: string): boolean {
  if (!/^\d{11}$/.test(piva)) return false;
  const digits = piva.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      sum += digits[i];
    } else {
      const doubled = digits[i] * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[10];
}

/** Valida un Codice Fiscale italiano (16 char alfanumerico). NON valida il checksum (richiede tabella). */
export function isValidCodiceFiscale(cf: string): boolean {
  return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i.test(cf);
}
