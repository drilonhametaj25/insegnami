import type {
  Invoice,
  InvoiceLine,
  InvoiceCustomerProfile,
  InvoiceSettings,
} from '@prisma/client';

/**
 * Build the FatturaPA XML for a given invoice. Conforms to specifica tecnica
 * AdE versione 1.7 (FPR12 — fattura tra privati).
 *
 * String-based assembly (no xmlbuilder2 dep) is fine for FatturaPA because
 * the document tree is shallow and well-typed; we centralize escaping in
 * `xmlEscape` and decimal formatting in `fmt2/fmt8`.
 *
 * Output is UTF-8 plaintext WITHOUT BOM (SDI parsers reject BOM). Caller is
 * responsible for digital signing (XAdES-BES) — typically the SDI provider
 * (ACube, Aruba) does it server-side, so we ship the unsigned XML.
 *
 * IMPORTANT — what's deliberately omitted in this first cut:
 *   - DatiOrdineAcquisto / DatiContratto / DatiConvenzione / DatiRicezione
 *     (B2B references — not used by schools billing students)
 *   - Bollo virtuale (DatiBollo) — only when fattura > 77.47€ and esente IVA
 *     in scope but optional; we'll add when InvoiceLine modelling supports it
 *   - Allegati (Allegati) — out of scope for now
 *   - Multiple DatiPagamento blocks — we emit one block, with one or more
 *     DettaglioPagamento entries derived from Invoice.paymentTerms (Json)
 *
 * If SDI rejects an emitted XML for one of these reasons we add the relevant
 * block here in the next iteration — the SdiEvent.payloadXml has the error.
 */

export type FatturaPAInput = {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: InvoiceCustomerProfile;
  settings: InvoiceSettings;
  /**
   * Progressive transmission id. SDI requires a unique progressive per
   * trasmittente per session — we recommend the Invoice number combined
   * with year, but any unique ASCII id ≤10 chars works.
   */
  progressivoInvio: string;
};

export function buildFatturaPA(input: FatturaPAInput): string {
  const { invoice, lines, customer, settings, progressivoInvio } = input;

  const formato = customer.codiceDestinatario === 'XXXXXXX'
    ? 'FPR12'   // committente estero
    : 'FPR12';  // privati italiani — la PA usa FPA12

  const idTrasmittente = pickIdFiscaleIVA(settings.partitaIva, settings.codiceFiscale);
  const idCedente = idTrasmittente; // typically the same — la scuola è cedente E trasmittente

  const cessionarioId = pickIdFiscaleIVA(customer.partitaIva, customer.codiceFiscale);

  // Sort lines by lineNumber to ensure stable XML ordering.
  const sortedLines = [...lines].sort((a, b) => a.lineNumber - b.lineNumber);

  // Build DatiRiepilogo: one block per (vatRate, vatNature) combination.
  const riepilogo = computeRiepilogo(sortedLines);

  const datiPagamento = buildDatiPagamento(invoice);

  // Header
  const header = `
<FatturaElettronicaHeader>
  <DatiTrasmissione>
    <IdTrasmittente>
      <IdPaese>IT</IdPaese>
      <IdCodice>${xmlEscape(idTrasmittente)}</IdCodice>
    </IdTrasmittente>
    <ProgressivoInvio>${xmlEscape(progressivoInvio)}</ProgressivoInvio>
    <FormatoTrasmissione>${formato}</FormatoTrasmissione>
    <CodiceDestinatario>${xmlEscape(customer.codiceDestinatario)}</CodiceDestinatario>
    ${customer.pec ? `<PECDestinatario>${xmlEscape(customer.pec)}</PECDestinatario>` : ''}
  </DatiTrasmissione>
  <CedentePrestatore>
    <DatiAnagrafici>
      <IdFiscaleIVA>
        <IdPaese>IT</IdPaese>
        <IdCodice>${xmlEscape(idCedente)}</IdCodice>
      </IdFiscaleIVA>
      ${settings.codiceFiscale ? `<CodiceFiscale>${xmlEscape(settings.codiceFiscale)}</CodiceFiscale>` : ''}
      <Anagrafica>
        <Denominazione>${xmlEscape(settings.denominazione)}</Denominazione>
      </Anagrafica>
      <RegimeFiscale>${xmlEscape(settings.regimeFiscale)}</RegimeFiscale>
    </DatiAnagrafici>
    <Sede>
      <Indirizzo>${xmlEscape(settings.indirizzo)}</Indirizzo>
      <CAP>${xmlEscape(settings.cap)}</CAP>
      <Comune>${xmlEscape(settings.comune)}</Comune>
      ${settings.provincia ? `<Provincia>${xmlEscape(settings.provincia)}</Provincia>` : ''}
      <Nazione>${xmlEscape(settings.nazione)}</Nazione>
    </Sede>
  </CedentePrestatore>
  <CessionarioCommittente>
    <DatiAnagrafici>
      ${customer.partitaIva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${xmlEscape(customer.partitaIva)}</IdCodice></IdFiscaleIVA>` : ''}
      ${customer.codiceFiscale ? `<CodiceFiscale>${xmlEscape(customer.codiceFiscale)}</CodiceFiscale>` : ''}
      <Anagrafica>
        ${customer.denominazione
          ? `<Denominazione>${xmlEscape(customer.denominazione)}</Denominazione>`
          : `<Nome>${xmlEscape(customer.nome ?? '')}</Nome><Cognome>${xmlEscape(customer.cognome ?? '')}</Cognome>`}
      </Anagrafica>
    </DatiAnagrafici>
    <Sede>
      <Indirizzo>${xmlEscape(customer.indirizzo)}</Indirizzo>
      <CAP>${xmlEscape(customer.cap)}</CAP>
      <Comune>${xmlEscape(customer.comune)}</Comune>
      ${customer.provincia ? `<Provincia>${xmlEscape(customer.provincia)}</Provincia>` : ''}
      <Nazione>${xmlEscape(customer.nazione)}</Nazione>
    </Sede>
  </CessionarioCommittente>
</FatturaElettronicaHeader>`;

  // Body: DatiGenerali + DatiBeniServizi + DatiPagamento
  const isoIssue = invoice.issueDate.toISOString().slice(0, 10);
  const numeroFattura = String(invoice.number);

  const body = `
<FatturaElettronicaBody>
  <DatiGenerali>
    <DatiGeneraliDocumento>
      <TipoDocumento>${invoice.documentType}</TipoDocumento>
      <Divisa>${xmlEscape(invoice.currency)}</Divisa>
      <Data>${isoIssue}</Data>
      <Numero>${xmlEscape(numeroFattura)}</Numero>
      <ImportoTotaleDocumento>${fmt2(invoice.total)}</ImportoTotaleDocumento>
    </DatiGeneraliDocumento>
  </DatiGenerali>
  <DatiBeniServizi>
${sortedLines.map(buildDettaglioLinee).join('\n')}
${riepilogo.map(buildDatiRiepilogo).join('\n')}
  </DatiBeniServizi>
  ${datiPagamento}
</FatturaElettronicaBody>`;

  // Root with namespaces. The xsi:schemaLocation pointer matches FatturaPA 1.2.x
  // which is the version SDI accepts (the spec is "1.7" but the XSD filename
  // and namespace stayed at v1.2 for legacy reasons).
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="${formato}" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
${header}
${body}
</p:FatturaElettronica>`;

  return collapseBlankLines(xml);
}

// ---- Helpers ----

function buildDettaglioLinee(line: InvoiceLine): string {
  const numeroLinea = line.lineNumber;
  const description = (line.description ?? '').slice(0, 1000); // SDI max 1000 char
  const naturaTag = line.vatNature ? `<Natura>${xmlEscape(line.vatNature)}</Natura>` : '';
  return `    <DettaglioLinee>
      <NumeroLinea>${numeroLinea}</NumeroLinea>
      <Descrizione>${xmlEscape(description)}</Descrizione>
      <Quantita>${fmt8(line.quantity)}</Quantita>
      <PrezzoUnitario>${fmt8(line.unitPrice)}</PrezzoUnitario>
      ${line.discountPercent ? `<ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>${fmt2(line.discountPercent)}</Percentuale></ScontoMaggiorazione>` : ''}
      <PrezzoTotale>${fmt2(line.total)}</PrezzoTotale>
      <AliquotaIVA>${fmt2(line.vatRate)}</AliquotaIVA>
      ${naturaTag}
    </DettaglioLinee>`;
}

type RiepilogoBucket = {
  aliquota: number;     // e.g. 22, 10, 4, 0
  natura?: string;      // N1..N7 when aliquota=0
  imponibile: number;   // sum of line.total in this bucket
  imposta: number;      // imponibile × aliquota / 100
};

function computeRiepilogo(lines: InvoiceLine[]): RiepilogoBucket[] {
  const buckets = new Map<string, RiepilogoBucket>();
  for (const line of lines) {
    const aliquota = Number(line.vatRate);
    const natura = line.vatNature ?? undefined;
    const key = `${aliquota.toFixed(2)}|${natura ?? ''}`;
    const lineTotal = Number(line.total);
    const existing = buckets.get(key);
    if (existing) {
      existing.imponibile += lineTotal;
      existing.imposta = round2((existing.imponibile * aliquota) / 100);
    } else {
      buckets.set(key, {
        aliquota,
        natura,
        imponibile: lineTotal,
        imposta: round2((lineTotal * aliquota) / 100),
      });
    }
  }
  return Array.from(buckets.values());
}

function buildDatiRiepilogo(b: RiepilogoBucket): string {
  return `    <DatiRiepilogo>
      <AliquotaIVA>${fmt2(b.aliquota)}</AliquotaIVA>
      ${b.natura ? `<Natura>${xmlEscape(b.natura)}</Natura>` : ''}
      <ImponibileImporto>${fmt2(b.imponibile)}</ImponibileImporto>
      <Imposta>${fmt2(b.imposta)}</Imposta>
      ${b.aliquota === 0 ? `<EsigibilitaIVA>I</EsigibilitaIVA>` : `<EsigibilitaIVA>I</EsigibilitaIVA>`}
    </DatiRiepilogo>`;
}

function buildDatiPagamento(invoice: Invoice): string {
  const terms = (invoice.paymentTerms as Array<{ dueDate?: string; amount?: number; iban?: string }> | null) ?? null;
  if (!terms || terms.length === 0) {
    // Fallback: single payment due on issueDate, full amount.
    return `<DatiPagamento>
    <CondizioniPagamento>TP02</CondizioniPagamento>
    <DettaglioPagamento>
      <ModalitaPagamento>${xmlEscape(invoice.paymentMethod ?? 'MP05')}</ModalitaPagamento>
      <DataScadenzaPagamento>${invoice.issueDate.toISOString().slice(0, 10)}</DataScadenzaPagamento>
      <ImportoPagamento>${fmt2(invoice.total)}</ImportoPagamento>
    </DettaglioPagamento>
  </DatiPagamento>`;
  }

  const condizioni = terms.length > 1 ? 'TP01' : 'TP02';
  const dettagli = terms.map((t) => {
    const date = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : invoice.issueDate.toISOString().slice(0, 10);
    const amount = typeof t.amount === 'number' ? t.amount : Number(invoice.total);
    return `    <DettaglioPagamento>
      <ModalitaPagamento>${xmlEscape(invoice.paymentMethod ?? 'MP05')}</ModalitaPagamento>
      <DataScadenzaPagamento>${date}</DataScadenzaPagamento>
      <ImportoPagamento>${fmt2(amount)}</ImportoPagamento>
      ${t.iban ? `<IBAN>${xmlEscape(t.iban)}</IBAN>` : ''}
    </DettaglioPagamento>`;
  }).join('\n');

  return `<DatiPagamento>
    <CondizioniPagamento>${condizioni}</CondizioniPagamento>
${dettagli}
  </DatiPagamento>`;
}

/**
 * SDI requires either P.IVA or CF as IdFiscaleIVA. When both are present
 * P.IVA is preferred. Throws if neither is set — the caller (issue route)
 * should guard against this earlier.
 */
function pickIdFiscaleIVA(piva?: string | null, cf?: string | null): string {
  if (piva && piva.trim()) return piva.trim();
  if (cf && cf.trim()) return cf.trim();
  throw new Error('Né partita IVA né codice fiscale presenti — XML FatturaPA non emettibile');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a Decimal/number with 2 decimal places (Italian fiscal standard). */
function fmt2(value: any): string {
  return Number(value).toFixed(2);
}

/** Format with 8 decimals — used for Quantita and PrezzoUnitario per spec. */
function fmt8(value: any): string {
  // Specifica AdE: max 8 decimali, ma non c'è obbligo di tutti gli zero.
  // Tagliamo trailing zeros mantenendo almeno 2 decimali per leggibilità.
  const n = Number(value);
  const fixed = n.toFixed(8);
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.00');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Collapse runs of blank lines that emerge from conditional template fragments. */
function collapseBlankLines(s: string): string {
  return s.replace(/\n\s*\n+/g, '\n');
}
