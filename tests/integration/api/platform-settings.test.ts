/**
 * PlatformSettings (singleton 'platform'):
 * - registrazione bloccata quando allowNewRegistrations = false
 * - trialDays letto dal DB (fallback 14 se il singleton manca)
 * - GET/PUT /api/superadmin/settings su prisma.platformSettings (solo SUPERADMIN)
 * - GET /api/platform/status pubblico ({ maintenanceMode })
 */

import { POST as registerPost } from '@/app/api/auth/register/route'
import { GET as settingsGet, PUT as settingsPut } from '@/app/api/superadmin/settings/route'
import { GET as statusGet } from '@/app/api/platform/status/route'

jest.mock('@/lib/db', () => ({
  prisma: {
    platformSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    userTenant: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    subscription: { count: jest.fn() },
    plan: { count: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}))

jest.mock('@/lib/config', () => ({
  isSaaSMode: true,
}))

jest.mock('@/lib/auth-utils', () => ({
  ...jest.requireActual('@/lib/auth-utils'),
  generateVerificationToken: jest.fn(() => 'mock-verification-token'),
}))

jest.mock('@/lib/api-middleware', () => ({
  escapeHtml: (str: string) => str.replace(/[&<>"']/g, ''),
}))

jest.mock('@/lib/stripe', () => ({
  getOrCreateCustomer: jest.fn(() => Promise.resolve({ id: 'cus_mock' })),
  stripe: {},
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => Promise.resolve({ success: true })),
  rateLimitByKey: jest.fn(() => Promise.resolve(true)),
}))

jest.mock('@/lib/tenant-bootstrap', () => ({
  bootstrapTenant: jest.fn(() => Promise.resolve()),
}))

const { prisma } = require('@/lib/db')
const { getAuth } = require('@/lib/auth')
const { sendEmail } = require('@/lib/email')

function createRequest(body?: any) {
  return {
    url: 'http://localhost:3000/api/test',
    json: () => Promise.resolve(body ?? {}),
  } as any
}

const validRegistration = {
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario@scuola.it',
  password: 'Password1',
  schoolName: 'Scuola Test',
  role: 'admin',
}

const superadminSession = {
  user: { id: 'sa-1', email: 'sa@insegnami.pro', role: 'SUPERADMIN', tenantId: 'tenant-sa' },
}

describe('PlatformSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sendEmail.mockResolvedValue({ success: true })
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.tenant.findUnique.mockResolvedValue(null)
    prisma.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Scuola Test',
      slug: 'scuola-test',
    })
    prisma.tenant.update.mockResolvedValue({})
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'mario@scuola.it',
      firstName: 'Mario',
      lastName: 'Rossi',
    })
    prisma.userTenant.create.mockResolvedValue({})
    prisma.verificationToken.create.mockResolvedValue({})
    prisma.platformSettings.findUnique.mockResolvedValue(null)
    prisma.tenant.count.mockResolvedValue(3)
    prisma.subscription.count.mockResolvedValue(2)
    prisma.plan.count.mockResolvedValue(3)
  })

  // ========================================
  // POST /api/auth/register + PlatformSettings
  // ========================================
  describe('registrazione governata dal singleton', () => {
    it('blocca la registrazione con 403 quando allowNewRegistrations è false', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({
        id: 'platform',
        defaultTrialDays: 14,
        allowNewRegistrations: false,
        maintenanceMode: false,
        graceDays: 7,
      })

      const response = await registerPost(createRequest(validRegistration))
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('registrazioni')
      expect(prisma.tenant.create).not.toHaveBeenCalled()
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('usa defaultTrialDays del DB per calcolare trialUntil', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({
        id: 'platform',
        defaultTrialDays: 30,
        allowNewRegistrations: true,
        maintenanceMode: false,
        graceDays: 7,
      })

      const before = Date.now()
      const response = await registerPost(createRequest(validRegistration))
      expect(response.status).toBe(200)

      const createCall = prisma.tenant.create.mock.calls[0][0]
      const trialUntil = new Date(createCall.data.trialUntil).getTime()
      const expected = before + 30 * 24 * 60 * 60 * 1000
      // Tolleranza di 1 minuto sull'orologio del test
      expect(Math.abs(trialUntil - expected)).toBeLessThan(60_000)
    })

    it('fallback a 14 giorni quando il singleton non esiste', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(null)

      const before = Date.now()
      const response = await registerPost(createRequest(validRegistration))
      expect(response.status).toBe(200)

      const createCall = prisma.tenant.create.mock.calls[0][0]
      const trialUntil = new Date(createCall.data.trialUntil).getTime()
      const expected = before + 14 * 24 * 60 * 60 * 1000
      expect(Math.abs(trialUntil - expected)).toBeLessThan(60_000)
    })

    it('fail-open: registrazione consentita se la lettura del singleton fallisce', async () => {
      prisma.platformSettings.findUnique.mockRejectedValue(new Error('db down'))

      const response = await registerPost(createRequest(validRegistration))

      expect(response.status).toBe(200)
      expect(prisma.tenant.create).toHaveBeenCalled()
    })
  })

  // ========================================
  // GET/PUT /api/superadmin/settings
  // ========================================
  describe('/api/superadmin/settings', () => {
    it('GET rifiuta i non-SUPERADMIN con 403', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.it', role: 'ADMIN', tenantId: 't1' },
      })

      const response = await settingsGet(createRequest())

      expect(response.status).toBe(403)
      expect(prisma.platformSettings.findUnique).not.toHaveBeenCalled()
    })

    it('GET ritorna i default quando il singleton non esiste ancora', async () => {
      getAuth.mockResolvedValue(superadminSession)
      prisma.platformSettings.findUnique.mockResolvedValue(null)

      const response = await settingsGet(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings).toMatchObject({
        defaultTrialDays: 14,
        allowNewRegistrations: true,
        maintenanceMode: false,
        graceDays: 7,
      })
      expect(data.platformInfo.totalTenants).toBe(3)
    })

    it('PUT esegue upsert del singleton con i soli campi validati', async () => {
      getAuth.mockResolvedValue(superadminSession)
      prisma.platformSettings.upsert.mockResolvedValue({
        id: 'platform',
        defaultTrialDays: 21,
        allowNewRegistrations: false,
        maintenanceMode: true,
        senderName: null,
        senderEmail: null,
        replyTo: null,
        graceDays: 10,
        updatedAt: new Date(),
      })

      const response = await settingsPut(
        createRequest({
          defaultTrialDays: 21,
          allowNewRegistrations: false,
          maintenanceMode: true,
          graceDays: 10,
        })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings.defaultTrialDays).toBe(21)
      expect(data.settings.maintenanceMode).toBe(true)
      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'platform' },
          update: {
            defaultTrialDays: 21,
            allowNewRegistrations: false,
            maintenanceMode: true,
            graceDays: 10,
          },
        })
      )
    })

    it('PUT rifiuta valori fuori range con 400', async () => {
      getAuth.mockResolvedValue(superadminSession)

      const response = await settingsPut(createRequest({ defaultTrialDays: 365 }))

      expect(response.status).toBe(400)
      expect(prisma.platformSettings.upsert).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // GET /api/platform/status (pubblico)
  // ========================================
  describe('/api/platform/status', () => {
    it('espone maintenanceMode dal singleton senza richiedere auth', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ maintenanceMode: true })

      const response = await statusGet()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ maintenanceMode: true })
      expect(getAuth).not.toHaveBeenCalled()
    })

    it('fail-open: maintenanceMode false su errore DB', async () => {
      prisma.platformSettings.findUnique.mockRejectedValue(new Error('db down'))

      const response = await statusGet()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ maintenanceMode: false })
    })
  })
})
