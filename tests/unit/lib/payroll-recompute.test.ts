/**
 * Unit — recomputePayrollTotals (lib/payroll/payroll-generator).
 *
 * Contratto (rev. contabilità): le ritenute NON vengono risommate dagli
 * amount persistiti — si riapplicano le aliquote sulla NUOVA base
 * (ore + extra) e si riallineano base/amount delle righe.
 */
jest.mock('@/lib/db', () => ({
  prisma: {},
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { recomputePayrollTotals } from '@/lib/payroll/payroll-generator'

function makeTx(payroll: any) {
  return {
    payroll: {
      findUnique: jest.fn().mockResolvedValue(payroll),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: payroll?.id, ...data })),
    },
    payrollWithholding: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as any
}

const basePayroll = {
  id: 'pr-1',
  status: 'DRAFT',
  lineItems: [
    { id: 'li-1', type: 'HOURS', total: 300 },   // 15h × 20€
    { id: 'li-2', type: 'HOURS', total: 100 },   // 5h × 20€
    { id: 'li-3', type: 'BONUS', total: 50 },
    { id: 'li-4', type: 'EXPENSE_REIMBURSEMENT', total: 25.5 },
  ],
  withholdings: [
    // amount volutamente SBAGLIATO (es. arrivato dal client): va ignorato
    { id: 'wh-1', type: 'RITENUTA_ACCONTO', label: 'Ritenuta 20%', rate: 20, base: 1, amount: 999 },
  ],
}

beforeEach(() => jest.clearAllMocks())

describe('recomputePayrollTotals', () => {
  it('riapplica le aliquote sulla nuova base (ore + extra) ignorando gli amount persistiti', async () => {
    const tx = makeTx(basePayroll)

    const updated = await recomputePayrollTotals('pr-1', tx)

    // grossBase = 400 (solo HOURS), extras = 75.5, base imponibile = 475.5
    // ritenuta 20% su 475.5 = 95.10 → net = 475.5 - 95.1 = 380.4
    expect(Number(updated.grossBase)).toBe(400)
    expect(Number(updated.extrasTotal)).toBe(75.5)
    expect(Number(updated.withholdingsTotal)).toBe(95.1)
    expect(Number(updated.netAmount)).toBe(380.4)

    // La riga di ritenuta è stata riallineata (base e amount ricalcolati)
    expect(tx.payrollWithholding.update).toHaveBeenCalledTimes(1)
    const whUpdate = tx.payrollWithholding.update.mock.calls[0][0]
    expect(whUpdate.where).toEqual({ id: 'wh-1' })
    expect(Number(whUpdate.data.base)).toBe(475.5)
    expect(Number(whUpdate.data.amount)).toBe(95.1)
  })

  it('più ritenute: ciascuna riapplicata in parallelo sulla stessa base', async () => {
    const tx = makeTx({
      ...basePayroll,
      lineItems: [{ id: 'li-1', type: 'HOURS', total: 1000 }],
      withholdings: [
        { id: 'wh-1', type: 'RITENUTA_ACCONTO', label: 'Ritenuta 20%', rate: 20, base: 0, amount: 0 },
        { id: 'wh-2', type: 'INPS', label: 'INPS 4%', rate: 4, base: 0, amount: 0 },
      ],
    })

    const updated = await recomputePayrollTotals('pr-1', tx)

    expect(Number(updated.withholdingsTotal)).toBe(240) // 200 + 40
    expect(Number(updated.netAmount)).toBe(760)
    const amounts = tx.payrollWithholding.update.mock.calls.map(
      (c: any[]) => Number(c[0].data.amount),
    )
    expect(amounts).toEqual([200, 40])
  })

  it('senza ritenute: net = ore + extra', async () => {
    const tx = makeTx({ ...basePayroll, withholdings: [] })

    const updated = await recomputePayrollTotals('pr-1', tx)

    expect(Number(updated.withholdingsTotal)).toBe(0)
    expect(Number(updated.netAmount)).toBe(475.5)
    expect(tx.payrollWithholding.update).not.toHaveBeenCalled()
  })

  it('rifiuta i cedolini non DRAFT', async () => {
    const tx = makeTx({ ...basePayroll, status: 'APPROVED' })

    await expect(recomputePayrollTotals('pr-1', tx)).rejects.toThrow(/only DRAFT/)
    expect(tx.payroll.update).not.toHaveBeenCalled()
  })

  it('payroll inesistente → errore esplicito', async () => {
    const tx = makeTx(null)
    await expect(recomputePayrollTotals('pr-1', tx)).rejects.toThrow(/not found/)
  })
})
