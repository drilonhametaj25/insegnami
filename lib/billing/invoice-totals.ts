/**
 * Calcolo totali fattura — funzione PURA condivisa tra server e client.
 *
 * Estratta dalla logica del POST /api/invoices (creazione bozza): l'anteprima
 * dei totali nel form di creazione DEVE coincidere al centesimo con quanto
 * persisterà il server. Qualsiasi modifica qui cambia gli importi fiscali:
 * i test in tests/unit/lib/invoice-totals.test.ts fissano i valori attuali.
 *
 * Regole (identiche al server):
 *   - totale riga = round2(quantity × unitPrice × (1 - discountPercent/100))
 *   - subtotal    = round2(Σ totali riga)
 *   - vatTotal    = round2(Σ (totaleRiga × vatRate / 100))
 *     (i contributi IVA di riga si sommano PRIMA dell'arrotondamento)
 *   - total       = round2(subtotal + vatTotal)
 */

export interface InvoiceTotalsLineInput {
  /** Default 1 — rispecchia lo zod `.default(1)` del server. */
  quantity?: number;
  unitPrice: number;
  vatRate: number;
  vatNature?: string | null;
  /** 0/undefined/null = nessuno sconto (il server usa un check falsy). */
  discountPercent?: number | null;
}

export interface ComputedInvoiceTotals {
  /** Totale imponibile di ogni riga, nell'ordine di input (1-based → idx+1). */
  lineTotals: number[];
  subtotal: number;
  vatTotal: number;
  total: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLineTotal(line: InvoiceTotalsLineInput): number {
  const quantity = line.quantity ?? 1;
  const discount = line.discountPercent ? line.discountPercent / 100 : 0;
  return round2(quantity * line.unitPrice * (1 - discount));
}

export function computeInvoiceTotals(lines: InvoiceTotalsLineInput[]): ComputedInvoiceTotals {
  const lineTotals = lines.map((l) => computeLineTotal(l));
  const subtotal = round2(lineTotals.reduce((s, t) => s + t, 0));
  const vatTotal = round2(
    lineTotals.reduce((s, t, idx) => s + (t * lines[idx].vatRate) / 100, 0),
  );
  const total = round2(subtotal + vatTotal);
  return { lineTotals, subtotal, vatTotal, total };
}
