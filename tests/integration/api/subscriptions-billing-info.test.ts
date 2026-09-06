/**
 * Dati di fatturazione del tenant (GET/PUT /api/subscriptions/billing-info):
 * envelope { data, meta }, ruoli billing (ADMIN/DIRECTOR/SUPERADMIN),
 * normalizzazione stringhe vuote → null.
 */

import { GET as billingInfoGet, PUT as billingInfoPut } from '@/app/api/subscriptions/billing-info/route'

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

// requireAuth importa tenant-access e features: mock leggeri
jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/billing/features', () => ({
  hasFeature: jest.fn().mockResolvedValue(true),
  getEffectiveFeatures: jest.fn().mockResolvedValue({}),
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const { getTenantAccessCached } = require('@/lib/tenant-access')

function createRequest(body?: any) {
  return {
    url: 'http://localhost:3000/api/subscriptions/billing-info',
    json: () => Promise.resolve(body ?? {}),
  } as any
}

const adminSession = {
  user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

const billingRow = {
  billingName: 'Scuola Test SRL',
  vatNumber: 'IT01234567890',
  taxCode: 'STSRL123',
  sdiCode: 'ABC1234',
  pec: 'fatture@pec.scuola.it',
}

describe('/api/subscriptions/billing-info', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue(adminSession)
    getTenantAccessCached.mockResolvedValue({ ok: true })
  })

  describe('GET', () => {
    it('ritorna i dati fiscali del tenant in envelope { data, meta }', async () => {
      prisma.tenant.findUnique.mockResolvedValue(billingRow)

      const response = await billingInfoGet()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data).toEqual(billingRow)
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tenant-1' } })
      )
    })

    it('rifiuta i ruoli non billing con 403', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'u2', email: 't@scuola.it', role: 'TEACHER', tenantId: 'tenant-1' },
      })

      const response = await billingInfoGet()

      expect(response.status).toBe(403)
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled()
    })

    it('resta accessibile a tenant bloccati (skipTenantAccessCheck)', async () => {
      getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'subscription-past-due' })
      prisma.tenant.findUnique.mockResolvedValue(billingRow)

      const response = await billingInfoGet()

      expect(response.status).toBe(200)
      // il check commerciale NON deve essere invocato su questa route
      expect(getTenantAccessCached).not.toHaveBeenCalled()
    })
  })

  describe('PUT', () => {
    it('aggiorna i campi fiscali del tenant e ritorna { data }', async () => {
      prisma.tenant.update.mockResolvedValue(billingRow)

      const response = await billingInfoPut(createRequest(billingRow))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data).toEqual(billingRow)
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: billingRow,
        })
      )
    })

    it('normalizza le stringhe vuote a null', async () => {
      prisma.tenant.update.mockResolvedValue({ ...billingRow, vatNumber: null })

      const response = await billingInfoPut(
        createRequest({ billingName: 'Scuola Test SRL', vatNumber: '   ' })
      )

      expect(response.status).toBe(200)
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { billingName: 'Scuola Test SRL', vatNumber: null },
        })
      )
    })

    it('rifiuta una PEC non valida con 400', async () => {
      const response = await billingInfoPut(createRequest({ pec: 'non-una-email' }))

      expect(response.status).toBe(400)
      expect(prisma.tenant.update).not.toHaveBeenCalled()
    })

    it('rifiuta body senza campi con 400', async () => {
      const response = await billingInfoPut(createRequest({}))

      expect(response.status).toBe(400)
      expect(prisma.tenant.update).not.toHaveBeenCalled()
    })

    it('rifiuta i ruoli non billing con 403', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'u3', email: 's@scuola.it', role: 'SECRETARY', tenantId: 'tenant-1' },
      })

      const response = await billingInfoPut(createRequest(billingRow))

      expect(response.status).toBe(403)
      expect(prisma.tenant.update).not.toHaveBeenCalled()
    })
  })
})
