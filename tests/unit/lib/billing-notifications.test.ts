/**
 * notifyTenantAdmins — fan-out delle notifiche commerciali (billing) verso
 * gli amministratori (ADMIN/DIRECTOR) del tenant. Deve essere "safe by
 * design": mai throw, perché viene invocata fire-and-forget dal webhook
 * Stripe e dai cron — un errore qui non deve mai causare retry storm.
 */

jest.mock('@/lib/db', () => ({
  prisma: {
    userTenant: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/notifications/dispatcher', () => ({
  createAndDispatch: jest.fn(),
}))

import { notifyTenantAdmins } from '@/lib/notifications/billing-notifications'

const { prisma } = require('@/lib/db')
const { createAndDispatch } = require('@/lib/notifications/dispatcher')

describe('notifyTenantAdmins', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createAndDispatch.mockResolvedValue({
      notification: { id: 'notif-1' },
      emailEnqueued: true,
    })
  })

  it('notifica solo ADMIN e DIRECTOR del tenant indicato (filtro in query)', async () => {
    prisma.userTenant.findMany.mockResolvedValue([
      {
        userId: 'user-admin',
        tenantId: 'tenant-1',
        role: 'ADMIN',
        user: { id: 'user-admin', email: 'admin@scuola.it' },
      },
      {
        userId: 'user-director',
        tenantId: 'tenant-1',
        role: 'DIRECTOR',
        user: { id: 'user-director', email: 'director@scuola.it' },
      },
    ])

    const count = await notifyTenantAdmins('tenant-1', {
      title: 'Abbonamento attivato',
      content: 'Il piano Professional è attivo.',
      actionUrl: '/dashboard/billing',
    })

    // Il filtro per ruolo e tenant deve stare nella query, non in memoria
    expect(prisma.userTenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          role: { in: ['ADMIN', 'DIRECTOR'] },
        }),
      })
    )
    expect(createAndDispatch).toHaveBeenCalledTimes(2)
    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-admin',
        title: 'Abbonamento attivato',
        content: 'Il piano Professional è attivo.',
        actionUrl: '/dashboard/billing',
      }),
      { sendEmail: true }
    )
    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-director' }),
      { sendEmail: true }
    )
    expect(count).toBe(2)
  })

  it('inoltra priority/sourceType/sourceId a createAndDispatch', async () => {
    prisma.userTenant.findMany.mockResolvedValue([
      { userId: 'user-admin', tenantId: 'tenant-1', role: 'ADMIN', user: { id: 'user-admin', email: 'a@b.it' } },
    ])

    await notifyTenantAdmins('tenant-1', {
      title: 'Pagamento non riuscito',
      content: 'Il rinnovo non è andato a buon fine.',
      priority: 'URGENT',
      sourceType: 'invoice',
      sourceId: 'in_123',
    })

    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'URGENT',
        sourceType: 'invoice',
        sourceId: 'in_123',
      }),
      { sendEmail: true }
    )
  })

  it('notifica in-app anche gli utenti senza email (decide createAndDispatch)', async () => {
    prisma.userTenant.findMany.mockResolvedValue([
      {
        userId: 'user-no-email',
        tenantId: 'tenant-1',
        role: 'ADMIN',
        user: { id: 'user-no-email', email: null },
      },
    ])

    const count = await notifyTenantAdmins('tenant-1', {
      title: 'La prova termina tra pochi giorni',
      content: 'Scegli un piano.',
    })

    // Non filtriamo a monte: la riga Notification in-app va comunque creata,
    // è il dispatcher a decidere che l'email non parte (no-recipient-email)
    expect(createAndDispatch).toHaveBeenCalledTimes(1)
    expect(createAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-no-email' }),
      { sendEmail: true }
    )
    expect(count).toBe(1)
  })

  it('errore prisma → ritorna 0 senza lanciare', async () => {
    prisma.userTenant.findMany.mockRejectedValue(new Error('DB down'))

    await expect(
      notifyTenantAdmins('tenant-1', { title: 'X', content: 'Y' })
    ).resolves.toBe(0)
    expect(createAndDispatch).not.toHaveBeenCalled()
  })

  it('errore su un destinatario non blocca gli altri', async () => {
    prisma.userTenant.findMany.mockResolvedValue([
      { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', user: { id: 'user-1', email: 'a@b.it' } },
      { userId: 'user-2', tenantId: 'tenant-1', role: 'DIRECTOR', user: { id: 'user-2', email: 'c@d.it' } },
    ])
    createAndDispatch
      .mockRejectedValueOnce(new Error('queue down'))
      .mockResolvedValueOnce({ notification: { id: 'notif-2' }, emailEnqueued: true })

    const count = await notifyTenantAdmins('tenant-1', { title: 'X', content: 'Y' })

    expect(createAndDispatch).toHaveBeenCalledTimes(2)
    expect(count).toBe(1) // conta solo i notificati con successo
  })
})
