/**
 * Test per GET/PUT /api/notifications/preferences (3C2)
 *
 * Preferenze notifiche per-utente (NotificationPreferences, unique userId):
 * - GET senza riga → default (emailEnabled true, nessuna quiet hour)
 * - GET con riga persistita → la riga
 * - PUT → upsert scoped sul proprio userId (mai su altri)
 * - PUT quiet hours attive senza orari → 400
 * - non autenticato → 401
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
    notificationPreferences: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

import { GET, PUT } from '@/app/api/notifications/preferences/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest(method: string, body?: any) {
  return {
    url: 'http://localhost:3000/api/notifications/preferences',
    method,
    headers: { get: () => null },
    json: () => Promise.resolve(body ?? {}),
  } as any
}

const persistedPrefs = {
  id: 'pref-1',
  userId: 'user-1',
  emailEnabled: false,
  emailDigest: true,
  emailImmediate: false,
  pushEnabled: true,
  pushSound: true,
  typePreferences: { PAYMENT: false },
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  digestFrequency: 'daily',
  digestTime: '09:00',
}

describe('GET /api/notifications/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'utente@test.it', role: 'PARENT', tenantId: 'tenant-1' },
    })
  })

  it('non autenticato → 401', async () => {
    getAuth.mockResolvedValue(null)
    const response = await GET(createRequest('GET'))
    expect(response.status).toBe(401)
  })

  it('senza riga persistita → default con emailEnabled true', async () => {
    prisma.notificationPreferences.findUnique.mockResolvedValue(null)

    const response = await GET(createRequest('GET'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.notificationPreferences.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(json.data.emailEnabled).toBe(true)
    expect(json.data.quietHoursEnabled).toBe(false)
    expect(json.meta.persisted).toBe(false)
  })

  it('con riga persistita → ritorna la riga', async () => {
    prisma.notificationPreferences.findUnique.mockResolvedValue({ ...persistedPrefs })

    const response = await GET(createRequest('GET'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.emailEnabled).toBe(false)
    expect(json.data.typePreferences).toEqual({ PAYMENT: false })
    expect(json.meta.persisted).toBe(true)
  })
})

describe('PUT /api/notifications/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'utente@test.it', role: 'PARENT', tenantId: 'tenant-1' },
    })
    prisma.notificationPreferences.upsert.mockResolvedValue({ ...persistedPrefs })
  })

  it('non autenticato → 401', async () => {
    getAuth.mockResolvedValue(null)
    const response = await PUT(createRequest('PUT', { emailEnabled: false }))
    expect(response.status).toBe(401)
  })

  it('upsert scoped sul proprio userId con i campi validati', async () => {
    const response = await PUT(
      createRequest('PUT', {
        emailEnabled: false,
        typePreferences: { PAYMENT: false, ATTENDANCE: true },
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.notificationPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        create: expect.objectContaining({
          userId: 'user-1',
          emailEnabled: false,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        }),
        update: expect.objectContaining({ emailEnabled: false }),
      }),
    )
    expect(json.data).toBeDefined()
    expect(json.meta.persisted).toBe(true)
  })

  it('quiet hours attive senza orari → 400 senza upsert', async () => {
    const response = await PUT(
      createRequest('PUT', { quietHoursEnabled: true, quietHoursStart: '22:00' }),
    )

    expect(response.status).toBe(400)
    expect(prisma.notificationPreferences.upsert).not.toHaveBeenCalled()
  })

  it('orario malformato → 400 di validazione', async () => {
    const response = await PUT(
      createRequest('PUT', {
        quietHoursEnabled: true,
        quietHoursStart: '25:99',
        quietHoursEnd: '08:00',
      }),
    )

    expect(response.status).toBe(400)
    expect(prisma.notificationPreferences.upsert).not.toHaveBeenCalled()
  })
})
