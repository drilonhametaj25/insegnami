import {
  recordPaymentRevenue,
  syncPaymentMovement,
  reversePaymentMovement,
} from '@/lib/accounting/movements'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

function mockTx() {
  return {
    accountingMovement: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      findUnique: jest.fn(),
    },
  } as any
}

describe('recordPaymentRevenue', () => {
  it('creates the movement with createdBy for the audit trail', async () => {
    const tx = mockTx()

    const result = await recordPaymentRevenue(tx, {
      tenantId: 'tenant-1',
      paymentId: 'pay-1',
      amount: 100,
      date: new Date('2026-06-01'),
      createdBy: 'user-1',
    })

    expect(result).toEqual({ movementId: 'mov-1', created: true })
    expect(tx.accountingMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          paymentId: 'pay-1',
          createdBy: 'user-1',
        }),
      })
    )
  })

  it('stays idempotent: second call returns the existing movement', async () => {
    const tx = mockTx()
    tx.accountingMovement.findFirst.mockResolvedValue({ id: 'mov-existing' })

    const result = await recordPaymentRevenue(tx, {
      tenantId: 'tenant-1',
      paymentId: 'pay-1',
      amount: 100,
      date: new Date('2026-06-01'),
    })

    expect(result).toEqual({ movementId: 'mov-existing', created: false })
    expect(tx.accountingMovement.create).not.toHaveBeenCalled()
  })
})

describe('syncPaymentMovement', () => {
  it('propagates createdBy to the created movement', async () => {
    const tx = mockTx()
    tx.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      tenantId: 'tenant-1',
      status: 'PAID',
      amount: 250,
      paidDate: new Date('2026-06-02'),
      dueDate: new Date('2026-06-01'),
      description: 'Retta giugno',
      studentId: 'stud-1',
      classId: null,
    })

    const result = await syncPaymentMovement(tx, 'pay-1', { createdBy: 'user-9' })

    expect(result.reason).toBe('created')
    expect(tx.accountingMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdBy: 'user-9' }),
      })
    )
  })

  it('does nothing for non-PAID payments', async () => {
    const tx = mockTx()
    tx.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'PENDING' })

    const result = await syncPaymentMovement(tx, 'pay-1')

    expect(result).toEqual({ movementId: null, reason: 'not-paid' })
    expect(tx.accountingMovement.create).not.toHaveBeenCalled()
  })
})

describe('reversePaymentMovement', () => {
  it('deletes the movement when a payment is un-paid', async () => {
    const tx = mockTx()
    const result = await reversePaymentMovement(tx, 'pay-1')
    expect(result).toEqual({ deleted: true })
    expect(tx.accountingMovement.deleteMany).toHaveBeenCalledWith({
      where: { paymentId: 'pay-1', source: 'PAYMENT', type: 'REVENUE' },
    })
  })
})
