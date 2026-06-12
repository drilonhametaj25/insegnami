import {
  round2,
  computeLineTotal,
  computeInvoiceTotals,
} from '@/lib/billing/invoice-totals';

/**
 * Regression-lock dei totali fattura (C2.1).
 *
 * I valori attesi sono FISSATI sulla logica attuale del POST /api/invoices
 * (app/api/invoices/route.ts), usata come oracolo:
 *   - totale riga  = round2(quantity × unitPrice × (1 - discountPercent/100))
 *   - subtotal     = round2(Σ totali riga)
 *   - vatTotal     = round2(Σ (totaleRiga × vatRate / 100))   ← somma PRIMA dell'arrotondamento
 *   - total        = round2(subtotal + vatTotal)
 *   - round2(n)    = Math.round(n × 100) / 100
 *
 * Qualsiasi modifica che faccia fallire questi test cambia gli importi
 * fiscali emessi: NON aggiornare i valori senza una decisione esplicita.
 */
describe('round2', () => {
  it('arrotonda a 2 decimali con half-up sui positivi (Math.round)', () => {
    expect(round2(0.125)).toBe(0.13);
    expect(round2(25.4745)).toBe(25.47);
    expect(round2(5.6034)).toBe(5.6);
    expect(round2(100)).toBe(100);
  });
});

describe('computeLineTotal', () => {
  it('riga semplice senza sconto', () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 100, vatRate: 22 })).toBe(100);
  });

  it('applica lo sconto percentuale', () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 50, vatRate: 22, discountPercent: 10 })).toBe(90);
  });

  it('arrotonda il totale riga a 2 decimali', () => {
    // 3 × 9.99 × 0.85 = 25.4745 → 25.47
    expect(computeLineTotal({ quantity: 3, unitPrice: 9.99, vatRate: 22, discountPercent: 15 })).toBe(25.47);
  });

  it('quantity assente → default 1 (come lo zod del server)', () => {
    expect(computeLineTotal({ unitPrice: 100, vatRate: 22 })).toBe(100);
  });

  it('discountPercent = 0 è trattato come nessuno sconto (falsy nel server)', () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 80, vatRate: 22, discountPercent: 0 })).toBe(80);
  });

  it('supporta quantità negative (righe di nota di credito)', () => {
    expect(computeLineTotal({ quantity: -1, unitPrice: 100, vatRate: 22 })).toBe(-100);
  });
});

describe('computeInvoiceTotals', () => {
  it('fattura a riga singola, IVA 22%', () => {
    const t = computeInvoiceTotals([{ quantity: 1, unitPrice: 100, vatRate: 22 }]);
    expect(t.lineTotals).toEqual([100]);
    expect(t.subtotal).toBe(100);
    expect(t.vatTotal).toBe(22);
    expect(t.total).toBe(122);
  });

  it('riga con sconto: 2 × 50 −10% @22%', () => {
    const t = computeInvoiceTotals([
      { quantity: 2, unitPrice: 50, vatRate: 22, discountPercent: 10 },
    ]);
    expect(t.lineTotals).toEqual([90]);
    expect(t.subtotal).toBe(90);
    expect(t.vatTotal).toBe(19.8);
    expect(t.total).toBe(109.8);
  });

  it('arrotondamento riga prima del calcolo IVA: 3 × 9.99 −15% @22%', () => {
    // riga: 25.4745 → 25.47; IVA: 25.47 × 22% = 5.6034 → 5.6
    const t = computeInvoiceTotals([
      { quantity: 3, unitPrice: 9.99, vatRate: 22, discountPercent: 15 },
    ]);
    expect(t.lineTotals).toEqual([25.47]);
    expect(t.subtotal).toBe(25.47);
    expect(t.vatTotal).toBe(5.6);
    expect(t.total).toBe(31.07);
  });

  it('aliquote IVA multiple + riga esente (natura N4)', () => {
    const t = computeInvoiceTotals([
      { quantity: 1, unitPrice: 100, vatRate: 22 },
      { quantity: 1, unitPrice: 100, vatRate: 10 },
      { quantity: 1, unitPrice: 50, vatRate: 0, vatNature: 'N4' },
    ]);
    expect(t.lineTotals).toEqual([100, 100, 50]);
    expect(t.subtotal).toBe(250);
    expect(t.vatTotal).toBe(32);
    expect(t.total).toBe(282);
  });

  it('IVA: somma dei contributi di riga PRIMA dell\'arrotondamento (non per riga)', () => {
    // Ogni riga: 10.25 × 22% = 2.255. Arrotondando per riga verrebbe
    // 2.26 + 2.26 = 4.52; il server somma e arrotonda alla fine → 4.51.
    const t = computeInvoiceTotals([
      { quantity: 1, unitPrice: 10.25, vatRate: 22 },
      { quantity: 1, unitPrice: 10.25, vatRate: 22 },
    ]);
    expect(t.subtotal).toBe(20.5);
    expect(t.vatTotal).toBe(4.51);
    expect(t.total).toBe(25.01);
  });

  it('righe negative (stile nota di credito) producono totali negativi', () => {
    const t = computeInvoiceTotals([{ quantity: -1, unitPrice: 100, vatRate: 22 }]);
    expect(t.lineTotals).toEqual([-100]);
    expect(t.subtotal).toBe(-100);
    expect(t.vatTotal).toBe(-22);
    expect(t.total).toBe(-122);
  });

  it('nessuna riga → tutti zero (il server richiede min 1 riga, la UI può passare [])', () => {
    const t = computeInvoiceTotals([]);
    expect(t.lineTotals).toEqual([]);
    expect(t.subtotal).toBe(0);
    expect(t.vatTotal).toBe(0);
    expect(t.total).toBe(0);
  });
});
