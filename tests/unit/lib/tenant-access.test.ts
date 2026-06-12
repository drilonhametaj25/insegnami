/**
 * Matrice dei verdetti di checkTenantAccess + caching Redis di
 * getTenantAccessCached. L'enforcement a runtime (402/403 sulle route)
 * dipende interamente da questa logica.
 */

jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findUnique: jest.fn(), updateMany: jest.fn() },
  },
}))

jest.mock('@/lib/redis', () => ({
  redis: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    del: jest.fn(),
  },
}))

import {
  checkTenantAccess,
  getTenantAccessCached,
  invalidateTenantAccessCache,
} from '@/lib/tenant-access'

const { prisma } = require('@/lib/db')
const { redis } = require('@/lib/redis')

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000)

function mockTenant(overrides: Record<string, any> = {}) {
  prisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-1',
    isActive: true,
    trialUntil: FUTURE,
    subscription: null,
    ...overrides,
  })
}

describe('checkTenantAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('blocks unknown tenants', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null)
    expect(await checkTenantAccess('nope')).toEqual({ ok: false, reason: 'tenant-not-found' })
  })

  it('blocks inactive tenants', async () => {
    mockTenant({ isActive: false })
    expect(await checkTenantAccess('tenant-1')).toEqual({ ok: false, reason: 'tenant-inactive' })
  })

  it.each([['ACTIVE'], ['TRIALING']])('allows subscription status %s', async (status) => {
    mockTenant({ subscription: { status, currentPeriodEnd: FUTURE } })
    expect(await checkTenantAccess('tenant-1')).toEqual({ ok: true })
  })

  it('blocks PAST_DUE subscriptions', async () => {
    mockTenant({ subscription: { status: 'PAST_DUE', currentPeriodEnd: FUTURE } })
    expect(await checkTenantAccess('tenant-1')).toEqual({
      ok: false,
      reason: 'subscription-past-due',
    })
  })

  it.each([['CANCELLED'], ['UNPAID'], ['PAUSED']])(
    'blocks subscription status %s',
    async (status) => {
      mockTenant({ subscription: { status, currentPeriodEnd: FUTURE } })
      expect(await checkTenantAccess('tenant-1')).toEqual({
        ok: false,
        reason: 'subscription-cancelled',
      })
    }
  )

  it('allows tenants on a live trial without subscription', async () => {
    mockTenant({ trialUntil: FUTURE, subscription: null })
    expect(await checkTenantAccess('tenant-1')).toEqual({ ok: true })
  })

  it('blocks tenants whose trial expired without subscription', async () => {
    mockTenant({ trialUntil: PAST, subscription: null })
    expect(await checkTenantAccess('tenant-1')).toEqual({ ok: false, reason: 'trial-expired' })
  })
})

describe('getTenantAccessCached', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redis.getJSON.mockResolvedValue(null)
    redis.setJSON.mockResolvedValue(true)
  })

  it('queries the DB on cache miss and caches the verdict', async () => {
    mockTenant()
    const verdict = await getTenantAccessCached('tenant-1')

    expect(verdict).toEqual({ ok: true })
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1)
    expect(redis.setJSON).toHaveBeenCalledWith(
      'tenant:access:tenant-1',
      { ok: true },
      expect.any(Number)
    )
  })

  it('returns the cached verdict without hitting the DB', async () => {
    redis.getJSON.mockResolvedValue({ ok: false, reason: 'trial-expired' })

    const verdict = await getTenantAccessCached('tenant-1')

    expect(verdict).toEqual({ ok: false, reason: 'trial-expired' })
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled()
  })

  it('falls back to the DB when Redis is unavailable', async () => {
    redis.getJSON.mockResolvedValue(null)
    redis.setJSON.mockResolvedValue(false)
    mockTenant({ isActive: false })

    const verdict = await getTenantAccessCached('tenant-1')

    expect(verdict).toEqual({ ok: false, reason: 'tenant-inactive' })
  })

  it('invalidateTenantAccessCache deletes the cache key', async () => {
    await invalidateTenantAccessCache('tenant-1')
    expect(redis.del).toHaveBeenCalledWith('tenant:access:tenant-1')
  })
})
