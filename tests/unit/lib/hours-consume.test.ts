/**
 * Unit — consumo/refund ore pacchetti (lib/hours/consume).
 *
 * Contratto (rev. contabilità):
 *  - consumo SOLO per studenti con Attendance PRESENT/LATE
 *  - pacchetti scaduti esclusi (expiryDate vs inizio lezione)
 *  - FIFO con disattivazione del pacchetto a remainingHours 0
 *  - HoursLedger scritto per ogni erosione; P2002 = no-op (idempotenza hard)
 *  - refund su cancellazione: ripristino dal ledger + delete righe
 */
jest.mock('@/lib/db', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: any) => fn({})),
    lesson: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// Evita la catena prisma/email del service reale: stessa regola (≤20%, >0)
jest.mock('@/lib/hours-package-service', () => ({
  isPackageLowOnHours: (remaining: number, total: number) => {
    const pct = (remaining / total) * 100
    return pct <= 20 && pct > 0
  },
}))

import { consumeHoursForLesson, refundHoursForLesson } from '@/lib/hours/consume'

// Lezione di 2 ore, COMPLETED, non ancora consumata
const baseLesson = {
  id: 'les-1',
  tenantId: 'tenant-1',
  classId: 'class-1',
  status: 'COMPLETED',
  startTime: new Date('2026-06-01T10:00:00.000Z'),
  endTime: new Date('2026-06-01T12:00:00.000Z'),
  hoursConsumed: false,
  class: { courseId: 'course-1' },
}

function makeTx() {
  return {
    lesson: {
      findUnique: jest.fn().mockResolvedValue({ ...baseLesson }),
      update: jest.fn().mockResolvedValue({}),
    },
    attendance: {
      findMany: jest.fn().mockResolvedValue([{ studentId: 'stud-1' }]),
    },
    hoursPackage: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    hoursLedger: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as any
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('consumeHoursForLesson', () => {
  it('è idempotente: hoursConsumed true → no-op con reason already-consumed', async () => {
    const tx = makeTx()
    tx.lesson.findUnique.mockResolvedValue({ ...baseLesson, hoursConsumed: true })

    const result = await consumeHoursForLesson('les-1', tx)

    expect(result).toEqual({ consumed: false, reason: 'already-consumed' })
    expect(tx.hoursPackage.update).not.toHaveBeenCalled()
    expect(tx.hoursLedger.create).not.toHaveBeenCalled()
  })

  it('consuma SOLO per studenti PRESENT/LATE (query attendance filtrata)', async () => {
    const tx = makeTx()
    tx.attendance.findMany.mockResolvedValue([{ studentId: 'stud-1' }])
    tx.hoursPackage.findMany.mockResolvedValue([
      { id: 'pkg-1', remainingHours: 10, totalHours: 10 },
    ])

    const result = await consumeHoursForLesson('les-1', tx)

    expect(tx.attendance.findMany).toHaveBeenCalledWith({
      where: { lessonId: 'les-1', status: { in: ['PRESENT', 'LATE'] } },
      select: { studentId: true },
    })
    // Un solo studente frequenta → un solo scan pacchetti
    expect(tx.hoursPackage.findMany).toHaveBeenCalledTimes(1)
    expect(tx.hoursPackage.findMany.mock.calls[0][0].where.studentId).toBe('stud-1')
    expect(result.consumed).toBe(true)
    expect(result.studentsAffected).toBe(1)
    expect(result.totalHoursDeducted).toBe(2)
  })

  it('nessuna presenza PRESENT/LATE → marca consumata senza toccare i pacchetti', async () => {
    const tx = makeTx()
    tx.attendance.findMany.mockResolvedValue([])

    const result = await consumeHoursForLesson('les-1', tx)

    expect(result.consumed).toBe(false)
    expect(result.reason).toBe('no-attendees')
    expect(tx.hoursPackage.findMany).not.toHaveBeenCalled()
    // idempotenza: flag comunque alzato
    expect(tx.lesson.update).toHaveBeenCalledWith({
      where: { id: 'les-1' },
      data: { hoursConsumed: true },
    })
  })

  it('esclude i pacchetti scaduti (filtro expiryDate su inizio lezione)', async () => {
    const tx = makeTx()
    await consumeHoursForLesson('les-1', tx)

    const where = tx.hoursPackage.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { expiryDate: null },
      { expiryDate: { gt: baseLesson.startTime } },
    ])
    expect(where.isActive).toBe(true)
  })

  it('FIFO: eros multiple + disattiva il pacchetto arrivato a 0 e scrive il ledger', async () => {
    const tx = makeTx()
    tx.hoursPackage.findMany.mockResolvedValue([
      { id: 'pkg-old', remainingHours: 1.5, totalHours: 10 },
      { id: 'pkg-new', remainingHours: 5, totalHours: 10 },
    ])

    const result = await consumeHoursForLesson('les-1', tx)

    // pkg-old scende a 0 → disattivato; pkg-new scende a 4.5 → resta attivo
    expect(tx.hoursPackage.update).toHaveBeenCalledTimes(2)
    const updates = tx.hoursPackage.update.mock.calls.map((c: any[]) => c[0])
    expect(updates[0].where).toEqual({ id: 'pkg-old' })
    expect(Number(updates[0].data.remainingHours)).toBe(0)
    expect(updates[0].data.isActive).toBe(false)
    expect(updates[1].where).toEqual({ id: 'pkg-new' })
    expect(Number(updates[1].data.remainingHours)).toBe(4.5)
    expect(updates[1].data.isActive).toBe(true)

    // Ledger: una riga per pacchetto eroso
    expect(tx.hoursLedger.create).toHaveBeenCalledTimes(2)
    const ledgerRows = tx.hoursLedger.create.mock.calls.map((c: any[]) => c[0].data)
    expect(ledgerRows[0]).toMatchObject({
      tenantId: 'tenant-1', packageId: 'pkg-old', lessonId: 'les-1', studentId: 'stud-1',
    })
    expect(Number(ledgerRows[0].hours)).toBe(1.5)
    expect(Number(ledgerRows[1].hours)).toBe(0.5)

    expect(result.totalHoursDeducted).toBe(2)
  })

  it('P2002 sul ledger = consumo già registrato → no-op sul pacchetto, nessun throw', async () => {
    const tx = makeTx()
    tx.hoursPackage.findMany.mockResolvedValue([
      { id: 'pkg-1', remainingHours: 10, totalHours: 10 },
    ])
    tx.hoursLedger.create.mockRejectedValue({ code: 'P2002' })

    const result = await consumeHoursForLesson('les-1', tx)

    expect(result.consumed).toBe(true)
    // Ledger in conflitto → il decremento NON viene applicato di nuovo
    expect(tx.hoursPackage.update).not.toHaveBeenCalled()
  })

  it('segnala lowPackageStudentIds quando il pacchetto scende sotto il 20%', async () => {
    const tx = makeTx()
    tx.hoursPackage.findMany.mockResolvedValue([
      { id: 'pkg-1', remainingHours: 4, totalHours: 10 },
    ])

    const result = await consumeHoursForLesson('les-1', tx)

    // 4 - 2 = 2 su 10 → 20% → soglia raggiunta
    expect(result.lowPackageStudentIds).toEqual(['stud-1'])
  })
})

describe('refundHoursForLesson (lezione COMPLETED → CANCELLED)', () => {
  it('ripristina remainingHours dal ledger, riattiva i pacchetti e cancella le righe', async () => {
    const tx = makeTx()
    tx.hoursLedger.findMany.mockResolvedValue([
      { id: 'led-1', packageId: 'pkg-old', hours: 1.5 },
      { id: 'led-2', packageId: 'pkg-new', hours: 0.5 },
    ])
    tx.hoursPackage.findUnique
      .mockResolvedValueOnce({ remainingHours: 0 })
      .mockResolvedValueOnce({ remainingHours: 4.5 })

    const result = await refundHoursForLesson('les-1', tx)

    expect(result).toEqual({ refunded: true, totalHoursRestored: 2, packagesAffected: 2 })

    const updates = tx.hoursPackage.update.mock.calls.map((c: any[]) => c[0])
    expect(updates[0].where).toEqual({ id: 'pkg-old' })
    expect(Number(updates[0].data.remainingHours)).toBe(1.5)
    expect(updates[0].data.isActive).toBe(true) // riattivato
    expect(Number(updates[1].data.remainingHours)).toBe(5)

    expect(tx.hoursLedger.deleteMany).toHaveBeenCalledWith({ where: { lessonId: 'les-1' } })
    expect(tx.lesson.update).toHaveBeenCalledWith({
      where: { id: 'les-1' },
      data: { hoursConsumed: false },
    })
  })

  it('senza righe ledger è un no-op sicuro (nessun delete, flag comunque azzerato)', async () => {
    const tx = makeTx()
    tx.hoursLedger.findMany.mockResolvedValue([])

    const result = await refundHoursForLesson('les-1', tx)

    expect(result.refunded).toBe(false)
    expect(tx.hoursPackage.update).not.toHaveBeenCalled()
    expect(tx.hoursLedger.deleteMany).not.toHaveBeenCalled()
    expect(tx.lesson.update).toHaveBeenCalledWith({
      where: { id: 'les-1' },
      data: { hoursConsumed: false },
    })
  })
})
