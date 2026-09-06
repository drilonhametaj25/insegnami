/**
 * Gating di piano sulle route pacchetti ore ('hoursPackages') e generatore
 * orari ('scheduleGenerator'): 403 con code 'feature-not-in-plan' quando il
 * piano non include la feature, bypass SUPERADMIN, fail-open su errori infra.
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    hoursPackage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    student: { findFirst: jest.fn() },
    course: { findFirst: jest.fn() },
    schedule: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/billing/features', () => ({
  hasFeature: jest.fn(),
  getEffectiveFeatures: jest.fn().mockResolvedValue({}),
}))

jest.mock('@/lib/scheduling', () => ({
  generateSchedule: jest.fn(),
  DEFAULT_CONFIG: {},
}))

import { GET as packagesGet, POST as packagesPost } from '@/app/api/hours-packages/route'
import { GET as packageGet } from '@/app/api/hours-packages/[id]/route'
import { POST as generatePost } from '@/app/api/schedules/[id]/generate/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const { hasFeature } = require('@/lib/billing/features')

function createRequest(body?: any, url = 'http://localhost:3000/api/hours-packages') {
  return {
    url,
    json: () => Promise.resolve(body ?? {}),
  } as any
}

const adminSession = {
  user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

const superadminSession = {
  user: { id: 'sa-1', email: 'sa@insegnami.pro', role: 'SUPERADMIN', tenantId: 'tenant-sa' },
}

const routeParams = { params: Promise.resolve({ id: 'pkg-1' }) }

describe('feature gating: hoursPackages + scheduleGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue(adminSession)
    prisma.hoursPackage.findMany.mockResolvedValue([])
    prisma.hoursPackage.findFirst.mockResolvedValue(null)
    prisma.schedule.findFirst.mockResolvedValue(null)
  })

  describe('GET /api/hours-packages', () => {
    it('403 feature-not-in-plan quando il piano non include hoursPackages', async () => {
      hasFeature.mockResolvedValue(false)

      const response = await packagesGet(createRequest())
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.code).toBe('feature-not-in-plan')
      expect(prisma.hoursPackage.findMany).not.toHaveBeenCalled()
      expect(hasFeature).toHaveBeenCalledWith('tenant-1', 'hoursPackages')
    })

    it('passa quando la feature è inclusa', async () => {
      hasFeature.mockResolvedValue(true)

      const response = await packagesGet(createRequest())

      expect(response.status).toBe(200)
      expect(prisma.hoursPackage.findMany).toHaveBeenCalled()
    })

    it('SUPERADMIN bypassa il gate senza consultare le feature', async () => {
      getAuth.mockResolvedValue(superadminSession)

      const response = await packagesGet(createRequest())

      expect(response.status).toBe(200)
      expect(hasFeature).not.toHaveBeenCalled()
    })

    it('fail-open: se il check feature esplode la route procede', async () => {
      hasFeature.mockRejectedValue(new Error('redis down'))

      const response = await packagesGet(createRequest())

      expect(response.status).toBe(200)
      expect(prisma.hoursPackage.findMany).toHaveBeenCalled()
    })
  })

  describe('POST /api/hours-packages', () => {
    it('403 feature-not-in-plan per la creazione senza feature', async () => {
      hasFeature.mockResolvedValue(false)

      const response = await packagesPost(
        createRequest({ studentId: 's1', courseId: 'c1', totalHours: 10 })
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.code).toBe('feature-not-in-plan')
      expect(prisma.hoursPackage.create).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/hours-packages/[id]', () => {
    it('403 feature-not-in-plan sul dettaglio senza feature', async () => {
      hasFeature.mockResolvedValue(false)

      const response = await packageGet(createRequest(), routeParams)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.code).toBe('feature-not-in-plan')
      expect(prisma.hoursPackage.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/schedules/[id]/generate', () => {
    it('403 feature-not-in-plan quando scheduleGenerator non è nel piano', async () => {
      hasFeature.mockResolvedValue(false)

      const response = await generatePost(createRequest(undefined, 'http://localhost/api/schedules/s1/generate'), {
        params: Promise.resolve({ id: 's1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.code).toBe('feature-not-in-plan')
      expect(hasFeature).toHaveBeenCalledWith('tenant-1', 'scheduleGenerator')
      expect(prisma.schedule.findFirst).not.toHaveBeenCalled()
    })

    it('con la feature attiva il gate passa (404 sui dati mancanti, non 403)', async () => {
      hasFeature.mockResolvedValue(true)

      const response = await generatePost(createRequest(undefined, 'http://localhost/api/schedules/s1/generate'), {
        params: Promise.resolve({ id: 's1' }),
      })

      expect(response.status).toBe(404)
      expect(prisma.schedule.findFirst).toHaveBeenCalled()
    })
  })
})
