/**
 * Unit — buildFatturaPA (lib/billing/sdi/xml-builder).
 *
 * Copre le regole fiscali della revisione contabilità:
 *  - multi-aliquota → un DatiRiepilogo per (aliquota, natura)
 *  - esente con Natura N4 → Natura sia in DettaglioLinee che nel riepilogo
 *  - decimali: minimo 2 cifre (2.5 → '2.50'), fino a 8 se significative
 *  - DatiBollo (2.00) con bolloVirtuale attivo e imponibile esente > 77.47
 *  - FormatoTrasmissione FPA12 con codiceDestinatario PA a 6 caratteri
 *  - coerenza riepiloghi: Σ Imposta quadrata su Invoice.vatTotal
 */
import { buildFatturaPA } from '@/lib/billing/sdi/xml-builder'

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    denominazione: 'Scuola Test SRL',
    partitaIva: '01234567890',
    codiceFiscale: '01234567890',
    regimeFiscale: 'RF01',
    indirizzo: 'Via Roma 1',
    cap: '20100',
    comune: 'Milano',
    provincia: 'MI',
    nazione: 'IT',
    bolloVirtuale: false,
    ...overrides,
  } as any
}

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    denominazione: null,
    nome: 'Mario',
    cognome: 'Rossi',
    codiceFiscale: 'RSSMRA80A01F205X',
    partitaIva: null,
    pec: null,
    codiceDestinatario: '0000000',
    indirizzo: 'Via Cliente 2',
    cap: '20100',
    comune: 'Milano',
    provincia: 'MI',
    nazione: 'IT',
    ...overrides,
  } as any
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    number: 12,
    year: 2026,
    documentType: 'TD01',
    currency: 'EUR',
    issueDate: new Date('2026-03-15T10:00:00.000Z'),
    subtotal: 100,
    vatTotal: 22,
    total: 122,
    paymentMethod: 'MP05',
    paymentTerms: null,
    ...overrides,
  } as any
}

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    lineNumber: 1,
    description: 'Retta mensile',
    quantity: 1,
    unitPrice: 100,
    vatRate: 22,
    vatNature: null,
    discountPercent: null,
    total: 100,
    ...overrides,
  } as any
}

function build(opts: {
  lines: any[]
  invoice?: Record<string, unknown>
  customer?: Record<string, unknown>
  settings?: Record<string, unknown>
}) {
  return buildFatturaPA({
    invoice: makeInvoice(opts.invoice),
    lines: opts.lines,
    customer: makeCustomer(opts.customer),
    settings: makeSettings(opts.settings),
    progressivoInvio: '20260012',
  })
}

/** Estrae tutti i valori di un tag ripetuto. */
function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g')
  return Array.from(xml.matchAll(re)).map((m) => m[1])
}

describe('buildFatturaPA — riepiloghi multi-aliquota', () => {
  it('genera un DatiRiepilogo per ogni combinazione (aliquota, natura)', () => {
    const xml = build({
      lines: [
        makeLine({ lineNumber: 1, total: 100, vatRate: 22 }),
        makeLine({ lineNumber: 2, total: 50, vatRate: 10 }),
        makeLine({ lineNumber: 3, total: 30, vatRate: 22 }),
      ],
      invoice: { subtotal: 180, vatTotal: 33.6, total: 213.6 },
    })

    const blocks = xml.match(/<DatiRiepilogo>/g) ?? []
    expect(blocks).toHaveLength(2)

    const imponibili = extractAll(xml, 'ImponibileImporto')
    expect(imponibili).toContain('130.00') // 100 + 30 al 22%
    expect(imponibili).toContain('50.00')  // 50 al 10%

    const imposte = extractAll(xml, 'Imposta')
    expect(imposte).toContain('28.60') // 130 × 22%
    expect(imposte).toContain('5.00')  // 50 × 10%
  })

  it('esente art.10: aliquota 0 con Natura N4 su riga e riepilogo', () => {
    const xml = build({
      lines: [makeLine({ vatRate: 0, vatNature: 'N4', total: 100 })],
      invoice: { subtotal: 100, vatTotal: 0, total: 100 },
    })

    expect(xml).toContain('<Natura>N4</Natura>')
    // Natura presente sia nel dettaglio linea che nel riepilogo
    const nature = extractAll(xml, 'Natura')
    expect(nature).toHaveLength(2)
    expect(extractAll(xml, 'Imposta')).toEqual(['0.00'])
  })

  it('coerenza: se Σ Imposta dei bucket diverge da vatTotal oltre 0.01, l\'ultimo bucket assorbe la differenza', () => {
    // Bucket per-riepilogo: 100×22% = 22.00 e 50×10% = 5.00 → Σ 27.00.
    // La fattura dichiara vatTotal 27.05 (arrotondamenti per-riga diversi):
    // l'ultimo bucket deve assorbire +0.05.
    const xml = build({
      lines: [
        makeLine({ lineNumber: 1, total: 100, vatRate: 22 }),
        makeLine({ lineNumber: 2, total: 50, vatRate: 10 }),
      ],
      invoice: { subtotal: 150, vatTotal: 27.05, total: 177.05 },
    })

    const imposte = extractAll(xml, 'Imposta').map(Number)
    const sum = Math.round(imposte.reduce((s, v) => s + v, 0) * 100) / 100
    expect(sum).toBe(27.05)
  })
})

describe('buildFatturaPA — formattazione decimali', () => {
  it('quantità 2.5 → \'2.50\' (minimo 2 decimali)', () => {
    const xml = build({
      lines: [makeLine({ quantity: 2.5, unitPrice: 40, total: 100 })],
    })
    expect(xml).toContain('<Quantita>2.50</Quantita>')
    expect(xml).toContain('<PrezzoUnitario>40.00</PrezzoUnitario>')
  })

  it('mantiene fino a 8 decimali quando significativi', () => {
    const xml = build({
      lines: [makeLine({ quantity: 1.12345678, unitPrice: 0.375, total: 0.42 })],
    })
    expect(xml).toContain('<Quantita>1.12345678</Quantita>')
    expect(xml).toContain('<PrezzoUnitario>0.375</PrezzoUnitario>')
  })
})

describe('buildFatturaPA — bollo virtuale', () => {
  const esenteLines = [makeLine({ vatRate: 0, vatNature: 'N4', total: 100 })]

  it('emette DatiBollo 2.00 con bolloVirtuale attivo ed esente > 77.47', () => {
    const xml = build({
      lines: esenteLines,
      invoice: { subtotal: 100, vatTotal: 0, total: 100 },
      settings: { bolloVirtuale: true },
    })
    expect(xml).toContain('<BolloVirtuale>SI</BolloVirtuale>')
    expect(xml).toContain('<ImportoBollo>2.00</ImportoBollo>')
  })

  it('NIENTE DatiBollo se bolloVirtuale è disattivo', () => {
    const xml = build({
      lines: esenteLines,
      invoice: { subtotal: 100, vatTotal: 0, total: 100 },
      settings: { bolloVirtuale: false },
    })
    expect(xml).not.toContain('<DatiBollo>')
  })

  it('NIENTE DatiBollo se l\'esente non supera 77.47', () => {
    const xml = build({
      lines: [makeLine({ vatRate: 0, vatNature: 'N4', total: 77.47 })],
      invoice: { subtotal: 77.47, vatTotal: 0, total: 77.47 },
      settings: { bolloVirtuale: true },
    })
    expect(xml).not.toContain('<DatiBollo>')
  })

  it('NIENTE DatiBollo su fattura imponibile (non esente) anche sopra soglia', () => {
    const xml = build({
      lines: [makeLine({ vatRate: 22, total: 100 })],
      settings: { bolloVirtuale: true },
    })
    expect(xml).not.toContain('<DatiBollo>')
  })
})

describe('buildFatturaPA — formato trasmissione', () => {
  it('FPA12 quando codiceDestinatario è di 6 caratteri (ufficio PA)', () => {
    const xml = build({
      lines: [makeLine()],
      customer: { codiceDestinatario: 'ABC123' },
    })
    expect(xml).toContain('<FormatoTrasmissione>FPA12</FormatoTrasmissione>')
    expect(xml).toContain('versione="FPA12"')
  })

  it('FPR12 per i privati (codice a 7 caratteri, \'0000000\' incluso)', () => {
    const xml = build({ lines: [makeLine()] })
    expect(xml).toContain('<FormatoTrasmissione>FPR12</FormatoTrasmissione>')
  })
})
