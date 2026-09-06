/**
 * Test TDD per POST /api/disciplinary-notes/[id]/notify-parent (B3.2)
 *
 * Prima del fix la route creava solo la riga Notification via
 * NotificationService.createNotification (emailSent=true SENZA inviare nulla).
 * Dopo il fix deve passare dal dispatcher (createAndDispatch con sendEmail
 * true) così l'email parte davvero, mantenendo i guard esistenti e
 * l'aggiornamento di parentNotified.
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

// L'enforcement del tenant guard è testato altrove: qui lo bypassiamo
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    disciplinaryNote: { findFirst: jest.fn(), update: jest.fn() },
    studentGuardian: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/notifications/dispatcher', () => ({
  createAndDispatch: jest.fn(),
}))

import { POST } from '@/app/api/disciplinary-notes/[id]/notify-parent/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const { createAndDispatch } = require('@/lib/notifications/dispatcher')

function createRequest() {
  return {
    url: 'http://localhost:3000/api/disciplinary-notes/note-1/notify-parent',
    method: 'POST',
    headers: { get: () => null },
  } as any
}

const routeParams = { params: Promise.resolve({ id: 'note-1' }) }

const baseNote = {
  id: 'note-1',
  tenantId: 'tenant-1',
  studentId: 'student-1',
  title: 'Comportamento scorretto',
  description: 'Descrizione della nota disciplinare',
  severity: 'HIGH',
  parentNotified: false,
  parentNotifiedAt: null,
  student: {
    id: 'student-1',
    firstName: 'Marco',
    lastName: 'Bianchi',
    parentUser: { id: 'parent-user-1', email: 'genitore@test.it' },
  },
  teacher: { id: 'teacher-1', firstName: 'Anna', lastName: 'Verdi' },
}

describe('POST /api/disciplinary-notes/[id]/notify-parent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
    })
    createAndDispatch.mockResolvedValue({
      notification: { id: 'notif-1' },
      emailEnqueued: true,
    })
    // Nessun guardian aggiuntivo: resta il solo parentUser legacy
    prisma.studentGuardian.findMany.mockResolvedValue([])
    prisma.disciplinaryNote.update.mockResolvedValue({
      ...baseNote,
      parentNotified: true,
      parentNotifiedAt: new Date('2026-06-12T10:00:00Z'),
      student: { id: 'student-1', firstName: 'Marco', lastName: 'Bianchi' },
    })
  })

  it('invia davvero: createAndDispatch chiamato con sendEmail true e parentNotified aggiornato', async () => {
    prisma.disciplinaryNote.findFirst.mockResolvedValue({ ...baseNote })

    const response = await POST(createRequest(), routeParams)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // La notifica passa dal dispatcher (flusso reale di invio), NON dal
    // vecchio createNotification che marcava emailSent senza inviare
    expect(createAndDispatch).toHaveBeenCalledTimes(1)
    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'parent-user-1',
        type: 'ATTENDANCE',
        priority: 'HIGH',
        sourceType: 'disciplinary_note',
        sourceId: 'note-1',
        // Wave 2: il genitore atterra sulla propria vista, non su rotta admin
        actionUrl: '/it/dashboard/my/notes',
      }),
      expect.objectContaining({ sendEmail: true }),
    )

    // Il flag parentNotified viene aggiornato come prima
    expect(prisma.disciplinaryNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'note-1' },
        data: expect.objectContaining({
          parentNotified: true,
          parentNotifiedAt: expect.any(Date),
        }),
      }),
    )
  })

  it('genitore già notificato → 400 senza dispatch (comportamento esistente)', async () => {
    prisma.disciplinaryNote.findFirst.mockResolvedValue({
      ...baseNote,
      parentNotified: true,
      parentNotifiedAt: new Date('2026-06-01T08:00:00Z'),
    })

    const response = await POST(createRequest(), routeParams)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Genitore già notificato')
    expect(createAndDispatch).not.toHaveBeenCalled()
    expect(prisma.disciplinaryNote.update).not.toHaveBeenCalled()
  })

  it('studente senza genitore associato → 400 senza dispatch', async () => {
    prisma.disciplinaryNote.findFirst.mockResolvedValue({
      ...baseNote,
      student: { ...baseNote.student, parentUser: null },
    })

    const response = await POST(createRequest(), routeParams)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Nessun genitore associato a questo studente')
    expect(createAndDispatch).not.toHaveBeenCalled()
  })

  it('nota inesistente o di altro tenant → 404', async () => {
    prisma.disciplinaryNote.findFirst.mockResolvedValue(null)

    const response = await POST(createRequest(), routeParams)

    expect(response.status).toBe(404)
    // Lo scoping tenant deve stare nella query
    expect(prisma.disciplinaryNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'note-1', tenantId: 'tenant-1' }),
      }),
    )
    expect(createAndDispatch).not.toHaveBeenCalled()
  })

  it('ruolo non autorizzato (PARENT) → 403', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'user-2', email: 'parent@scuola.it', role: 'PARENT', tenantId: 'tenant-1' },
    })

    const response = await POST(createRequest(), routeParams)

    expect(response.status).toBe(403)
    expect(createAndDispatch).not.toHaveBeenCalled()
  })
})
