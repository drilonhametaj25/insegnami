/**
 * TDD C6 — Ricevuta email su Payment.PAID.
 *
 * Contratto:
 *  - PUT PENDING/OVERDUE→PAID: createAndDispatch chiamato per lo user dello
 *    studente E per il parentUser (se esiste), con sendEmail: true.
 *  - Studente senza parentUser → una sola chiamata.
 *  - PAID→PAID → nessuna ricevuta (non rinvia).
 *  - Dispatcher che rejecta → la PUT risponde comunque 200 (fire-and-forget).
 *  - POST con status PAID alla creazione → stessa ricevuta.
 *
 * Pattern mock: vedi crud.test.ts / delete-audit.test.ts.
 */
import { PUT as putPayment } from '@/app/api/payments/[id]/route'
import { POST as postPayment } from '@/app/api/payments/route'

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock tenant guard (enforcement testato altrove)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock api-auth (resolver usati solo dalla GET, ma importati a livello modulo)
jest.mock('@/lib/api-auth', () => ({
  getTeacherIdForUser: jest.fn().mockResolvedValue(null),
  getStudentIdForUser: jest.fn().mockResolvedValue(null),
}))

// Mock movimenti contabili (import dinamico dentro la transazione)
jest.mock('@/lib/accounting/movements', () => ({
  syncPaymentMovement: jest.fn().mockResolvedValue(undefined),
  reversePaymentMovement: jest.fn().mockResolvedValue(undefined),
}))

// Mock dispatcher notifiche: è il soggetto del test
jest.mock('@/lib/notifications/dispatcher', () => ({
  createAndDispatch: jest.fn().mockResolvedValue({ notification: { id: 'n1' }, emailEnqueued: true }),
}))

// Mock del TransactionClient esposto da $transaction
const mockTx = {
  payment: { update: jest.fn(), create: jest.fn() },
}

jest.mock('@/lib/db', () => ({
  prisma: {
    payment: { findFirst: jest.fn() },
    student: { findFirst: jest.fn() },
    studentClass: { findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(mockTx)),
  },
}))

const { getAuth } = require('@/lib/auth')
const { createAndDispatch } = require('@/lib/notifications/dispatcher')
const { prisma } = require('@/lib/db')

const adminSession = {
  user: { id: 'user-admin', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

function createRequest(body: any, method: 'PUT' | 'POST' = 'PUT') {
  return {
    method,
    json: () => Promise.resolve(body),
    headers: { get: jest.fn(() => null) },
  } as any
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

// Pagamento esistente (stato parametrico) e pagamento aggiornato restituito da tx
const existingPayment = (status: string) => ({
  id: 'pay-1',
  tenantId: 'tenant-1',
  studentId: 'stud-1',
  classId: null,
  description: 'Retta giugno',
  amount: 150,
  currency: 'EUR',
  status,
  dueDate: new Date('2026-06-01T00:00:00.000Z'),
  paidDate: status === 'PAID' ? new Date('2026-06-10T00:00:00.000Z') : null,
})

const updatedPaid = {
  ...existingPayment('PAID'),
  paidDate: new Date('2026-06-12T00:00:00.000Z'),
  student: { id: 'stud-1', firstName: 'Marco', lastName: 'Bianchi', studentCode: 'S001', email: 'marco@test.it' },
  class: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  getAuth.mockResolvedValue(adminSession)
  createAndDispatch.mockResolvedValue({ notification: { id: 'n1' }, emailEnqueued: true })
  mockTx.payment.update.mockResolvedValue(updatedPaid)
})

describe('PUT /api/payments/[id] — ricevuta su transizione →PAID (C6)', () => {
  it('PENDING→PAID invia ricevuta a studente E genitore con sendEmail true', async () => {
    prisma.payment.findFirst.mockResolvedValue(existingPayment('PENDING'))
    prisma.student.findFirst.mockResolvedValue({ userId: 'user-student', parentUserId: 'user-parent' })

    const res = await putPayment(createRequest({ status: 'PAID' }), routeParams('pay-1'))

    expect(res.status).toBe(200)
    expect(createAndDispatch).toHaveBeenCalledTimes(2)

    // 1ª chiamata: user dello studente
    expect(createAndDispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-student',
        title: 'Ricevuta di pagamento',
        type: 'PAYMENT',
        sourceType: 'Payment',
        sourceId: 'pay-1',
        actionUrl: '/dashboard/student',
      }),
      expect.objectContaining({ sendEmail: true }),
    )
    // 2ª chiamata: parentUser
    expect(createAndDispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'user-parent',
        title: 'Ricevuta di pagamento',
        actionUrl: '/dashboard/parent',
      }),
      expect.objectContaining({ sendEmail: true }),
    )

    // Il contenuto include importo formattato in stile italiano e descrizione
    const content: string = createAndDispatch.mock.calls[0][0].content
    expect(content).toContain('150,00')
    expect(content).toContain('Retta giugno')
  })

  it('OVERDUE→PAID invia comunque la ricevuta', async () => {
    prisma.payment.findFirst.mockResolvedValue(existingPayment('OVERDUE'))
    prisma.student.findFirst.mockResolvedValue({ userId: 'user-student', parentUserId: null })

    const res = await putPayment(createRequest({ status: 'PAID' }), routeParams('pay-1'))

    expect(res.status).toBe(200)
    expect(createAndDispatch).toHaveBeenCalledTimes(1)
  })

  it('studente senza parentUser → una sola ricevuta (allo studente)', async () => {
    prisma.payment.findFirst.mockResolvedValue(existingPayment('PENDING'))
    prisma.student.findFirst.mockResolvedValue({ userId: 'user-student', parentUserId: null })

    const res = await putPayment(createRequest({ status: 'PAID' }), routeParams('pay-1'))

    expect(res.status).toBe(200)
    expect(createAndDispatch).toHaveBeenCalledTimes(1)
    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-student' }),
      expect.objectContaining({ sendEmail: true }),
    )
  })

  it('PAID→PAID NON rinvia la ricevuta', async () => {
    prisma.payment.findFirst.mockResolvedValue(existingPayment('PAID'))
    prisma.student.findFirst.mockResolvedValue({ userId: 'user-student', parentUserId: 'user-parent' })

    const res = await putPayment(createRequest({ status: 'PAID' }), routeParams('pay-1'))

    expect(res.status).toBe(200)
    expect(createAndDispatch).not.toHaveBeenCalled()
  })

  it('dispatcher che rejecta → PUT risponde comunque 200 (fire-and-forget)', async () => {
    prisma.payment.findFirst.mockResolvedValue(existingPayment('PENDING'))
    prisma.student.findFirst.mockResolvedValue({ userId: 'user-student', parentUserId: 'user-parent' })
    createAndDispatch.mockRejectedValue(new Error('smtp down'))

    const res = await putPayment(createRequest({ status: 'PAID' }), routeParams('pay-1'))

    expect(res.status).toBe(200)
  })
})

describe('POST /api/payments — ricevuta quando il pagamento nasce già PAID (C6)', () => {
  const createdPaid = {
    id: 'pay-new',
    tenantId: 'tenant-1',
    studentId: 'stud-1',
    classId: null,
    description: 'Iscrizione annuale',
    amount: 99.5,
    currency: 'EUR',
    status: 'PAID',
    dueDate: new Date('2026-06-12T00:00:00.000Z'),
    paidDate: new Date('2026-06-12T00:00:00.000Z'),
    student: { id: 'stud-1', firstName: 'Marco', lastName: 'Bianchi', studentCode: 'S001', email: 'marco@test.it' },
    class: null,
  }

  const postBody = (status: string) => ({
    studentId: 'stud-1',
    amount: 99.5,
    status,
    dueDate: '2026-06-12T00:00:00.000Z',
    description: 'Iscrizione annuale',
  })

  it('status PAID alla creazione → ricevuta inviata', async () => {
    // findFirst serve sia alla verifica tenant sia al lookup destinatari
    prisma.student.findFirst.mockResolvedValue({
      id: 'stud-1', tenantId: 'tenant-1', userId: 'user-student', parentUserId: null,
    })
    mockTx.payment.create.mockResolvedValue(createdPaid)

    const res = await postPayment(createRequest(postBody('PAID'), 'POST'))

    expect(res.status).toBe(201)
    expect(createAndDispatch).toHaveBeenCalledTimes(1)
    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-student',
        title: 'Ricevuta di pagamento',
        sourceType: 'Payment',
        sourceId: 'pay-new',
      }),
      expect.objectContaining({ sendEmail: true }),
    )
  })

  it('status PENDING alla creazione → nessuna ricevuta', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 'stud-1', tenantId: 'tenant-1', userId: 'user-student', parentUserId: null,
    })
    mockTx.payment.create.mockResolvedValue({ ...createdPaid, status: 'PENDING', paidDate: null })

    const res = await postPayment(createRequest(postBody('PENDING'), 'POST'))

    expect(res.status).toBe(201)
    expect(createAndDispatch).not.toHaveBeenCalled()
  })
})
