/**
 * runTrialEndingReminder — cron giornaliero che avvisa gli admin dei tenant
 * con prova in scadenza (entro 3 giorni) e senza subscription attiva.
 * Dedup anti-spam: massimo una notifica ogni 4 giorni per tenant, tracciata
 * via Notification(sourceType='trial-reminder', sourceId=tenantId).
 */

jest.mock('bullmq', () => ({
  Queue: jest.fn(),
  Worker: jest.fn(),
}))

jest.mock('@/lib/redis', () => ({
  redis: { getConnectionConfig: jest.fn() },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findMany: jest.fn() },
    notification: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/automation-service', () => ({
  AutomationService: { runDailyAutomation: jest.fn() },
}))

jest.mock('@/lib/notifications/billing-notifications', () => ({
  notifyTenantAdmins: jest.fn(),
}))

import { runTrialEndingReminder } from '@/lib/workers/cron-scheduler'

const { prisma } = require('@/lib/db')
const { notifyTenantAdmins } = require('@/lib/notifications/billing-notifications')

const DAY_MS = 24 * 60 * 60 * 1000

describe('runTrialEndingReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    notifyTenantAdmins.mockResolvedValue(1)
    prisma.tenant.findMany.mockResolvedValue([])
    prisma.notification.findFirst.mockResolvedValue(null)
  })

  it('notifica i tenant con trial in scadenza tra 2 giorni e senza subscription', async () => {
    const trialUntil = new Date(Date.now() + 2 * DAY_MS)
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-1', name: 'Scuola Uno', trialUntil },
    ])
    prisma.notification.findFirst.mockResolvedValue(null) // mai notificato

    const result = await runTrialEndingReminder()

    expect(notifyTenantAdmins).toHaveBeenCalledTimes(1)
    expect(notifyTenantAdmins).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        title: expect.stringContaining('La prova termina il'),
        actionUrl: '/dashboard/billing',
        sourceType: 'trial-reminder',
        sourceId: 'tenant-1',
      })
    )
    expect(result).toEqual(
      expect.objectContaining({ candidates: 1, notified: 1, skipped: 0 })
    )
  })

  it('il titolo contiene la data di fine prova formattata', async () => {
    const trialUntil = new Date(Date.now() + 2 * DAY_MS)
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-1', name: 'Scuola Uno', trialUntil },
    ])

    await runTrialEndingReminder()

    const [, payload] = notifyTenantAdmins.mock.calls[0]
    expect(payload.title).toContain(trialUntil.toLocaleDateString('it-IT'))
  })

  it('salta i tenant già notificati di recente (Notification trial-reminder negli ultimi 4 giorni)', async () => {
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-1', name: 'Scuola Uno', trialUntil: new Date(Date.now() + 2 * DAY_MS) },
    ])
    prisma.notification.findFirst.mockResolvedValue({ id: 'notif-recente' })

    const result = await runTrialEndingReminder()

    // La query di dedup deve cercare per sourceType/sourceId e finestra temporale
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          sourceType: 'trial-reminder',
          sourceId: 'tenant-1',
          createdAt: { gte: expect.any(Date) },
        }),
      })
    )
    expect(notifyTenantAdmins).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({ candidates: 1, notified: 0, skipped: 1 })
    )
  })

  it('esclude dalla query i tenant con subscription o inattivi (filtro lato DB)', async () => {
    prisma.tenant.findMany.mockResolvedValue([]) // nessun candidato

    const result = await runTrialEndingReminder()

    // I tenant con subscription (o disattivati) non devono nemmeno essere
    // candidati: il filtro sta nella where, non in memoria
    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          subscription: { is: null },
          trialUntil: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      })
    )
    expect(notifyTenantAdmins).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({ candidates: 0, notified: 0, skipped: 0 })
    )
  })

  it('la finestra trialUntil copre i prossimi 3 giorni', async () => {
    const before = Date.now()
    await runTrialEndingReminder()
    const after = Date.now()

    const where = prisma.tenant.findMany.mock.calls[0][0].where
    const { gte, lte } = where.trialUntil
    expect(gte.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(gte.getTime()).toBeLessThanOrEqual(after + 1000)
    expect(lte.getTime() - gte.getTime()).toBe(3 * DAY_MS)
  })
})
