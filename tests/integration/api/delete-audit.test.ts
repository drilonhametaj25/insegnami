/**
 * TDD C0.3/C0.4 — Audit sui DELETE (Payment/Invoice/Payroll) + createdBy
 * propagato a syncPaymentMovement quando un pagamento passa a PAID.
 *
 * Pattern: si mockano @/lib/auth, @/lib/db, @/lib/tenant-guard e
 * @/lib/api-auth e si importano gli handler delle route direttamente
 * (vedi crud.test.ts come riferimento).
 */
import { PUT as putPayment, DELETE as deletePayment } from '@/app/api/payments/[id]/route'
import { DELETE as deleteInvoice } from '@/app/api/invoices/[id]/route'
import { DELETE as deletePayroll } from '@/app/api/payroll/[id]/route'

// Mock auth (stile getAuth — usato da payments)
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock tenant guard (l'enforcement è testato in tenant-guard.test.ts)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock api-auth (stile requireAuth+ctx — usato da invoices/payroll;
// payments importa da qui anche i resolver studente/docente)
jest.mock('@/lib/api-auth', () => ({
  requireAuth: jest.fn(),
  authError: jest.fn(() => null),
  tenantScope: (ctx: any, base: any = {}) => ({ ...base, tenantId: ctx.tenantId }),
  getTeacherIdForUser: jest.fn().mockResolvedValue(null),
  getStudentIdForUser: jest.fn().mockResolvedValue(null),
}))

// Mock movimenti contabili: verifichiamo solo gli argomenti passati
jest.mock('@/lib/accounting/movements', () => ({
  syncPaymentMovement: jest.fn().mockResolvedValue(undefined),
  reversePaymentMovement: jest.fn().mockResolvedValue(undefined),
}))

// Mock generatore payroll (importato a livello modulo dalla route)
jest.mock('@/lib/payroll/payroll-generator', () => ({
  recomputePayrollTotals: jest.fn().mockResolvedValue(undefined),
}))

// Mock del TransactionClient: $transaction lo espone alla callback così
// possiamo verificare che l'audit avvenga DENTRO la stessa transazione
// del delete (riferimento mockTx risolto lazy, alla chiamata).
const mockTx = {
  payment: { update: jest.fn(), delete: jest.fn() },
  invoice: { delete: jest.fn() },
  payroll: { delete: jest.fn() },
  auditLog: { create: jest.fn() },
}

jest.mock('@/lib/db', () => ({
  prisma: {
    payment: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    payroll: { findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(mockTx)),
  },
}))

const { getAuth } = require('@/lib/auth')
const { requireAuth } = require('@/lib/api-auth')
const { syncPaymentMovement } = require('@/lib/accounting/movements')
const { prisma } = require('@/lib/db')

const adminSession = {
  user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

const adminCtx = {
  session: adminSession,
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'ADMIN',
  email: 'admin@scuola.it',
  isSuperAdmin: false,
}

// Request minimale: logAudit legge headers per ip/user-agent
function createRequest(body?: any) {
  return {
    method: body ? 'PUT' : 'DELETE',
    json: () => Promise.resolve(body ?? {}),
    headers: { get: jest.fn(() => null) },
  } as any
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  getAuth.mockResolvedValue(adminSession)
  requireAuth.mockResolvedValue(adminCtx)
})

describe('DELETE /api/payments/[id] — audit C0.4', () => {
  const pendingPayment = {
    id: 'pay-1',
    tenantId: 'tenant-1',
    amount: 100,
    status: 'PENDING',
    studentId: 'stud-1',
    description: 'Retta giugno',
    paidDate: null,
  }

  it('scrive una riga di AuditLog (entity Payment, oldData snapshot) prima del delete', async () => {
    prisma.payment.findFirst.mockResolvedValue(pendingPayment)

    const response = await deletePayment(createRequest(), routeParams('pay-1'))

    expect(response.status).toBe(200)
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'DELETE',
          entity: 'Payment',
          entityId: 'pay-1',
          oldData: expect.objectContaining({
            id: 'pay-1',
            amount: 100,
            status: 'PENDING',
            studentId: 'stud-1',
            description: 'Retta giugno',
          }),
        }),
      })
    )
    // Il delete avviene nella stessa transazione dell'audit
    expect(mockTx.payment.delete).toHaveBeenCalledWith({ where: { id: 'pay-1' } })
  })

  it('blocca il delete dei pagamenti PAID (400) senza scrivere audit', async () => {
    prisma.payment.findFirst.mockResolvedValue({ ...pendingPayment, status: 'PAID' })

    const response = await deletePayment(createRequest(), routeParams('pay-1'))

    expect(response.status).toBe(400)
    expect(mockTx.auditLog.create).not.toHaveBeenCalled()
    expect(mockTx.payment.delete).not.toHaveBeenCalled()
  })
})

describe('PUT /api/payments/[id] — createdBy su syncPaymentMovement C0.3', () => {
  it('passa { createdBy } come terzo argomento al passaggio PENDING→PAID', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      tenantId: 'tenant-1',
      status: 'PENDING',
      paidDate: null,
    })
    mockTx.payment.update.mockResolvedValue({ id: 'pay-1', status: 'PAID' })

    const response = await putPayment(
      createRequest({ status: 'PAID' }),
      routeParams('pay-1')
    )

    expect(response.status).toBe(200)
    expect(syncPaymentMovement).toHaveBeenCalledWith(mockTx, 'pay-1', {
      createdBy: 'user-1',
    })
  })
})

describe('DELETE /api/invoices/[id] — audit C0.4', () => {
  it('scrive AuditLog (entity Invoice) sul delete di una bozza DRAFT', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      seriesId: 'series-1',
      number: 0,
      year: 2026,
      status: 'DRAFT',
      total: 150,
    })

    const response = await deleteInvoice(createRequest(), routeParams('inv-1'))

    expect(response.status).toBe(200)
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'DELETE',
          entity: 'Invoice',
          entityId: 'inv-1',
          oldData: expect.objectContaining({
            id: 'inv-1',
            seriesId: 'series-1',
            number: 0,
            year: 2026,
            status: 'DRAFT',
          }),
        }),
      })
    )
    expect(mockTx.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } })
  })
})

describe('DELETE /api/payroll/[id] — audit C0.4', () => {
  it('scrive AuditLog (entity Payroll) sul delete di un cedolino DRAFT', async () => {
    prisma.payroll.findFirst.mockResolvedValue({
      id: 'pr-1',
      tenantId: 'tenant-1',
      teacherId: 'teach-1',
      periodId: 'per-1',
      status: 'DRAFT',
      netAmount: 1200,
    })

    const response = await deletePayroll(createRequest(), routeParams('pr-1'))

    expect(response.status).toBe(200)
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'DELETE',
          entity: 'Payroll',
          entityId: 'pr-1',
          oldData: expect.objectContaining({
            id: 'pr-1',
            teacherId: 'teach-1',
            periodId: 'per-1',
            status: 'DRAFT',
          }),
        }),
      })
    )
    expect(mockTx.payroll.delete).toHaveBeenCalledWith({ where: { id: 'pr-1' } })
  })
})
