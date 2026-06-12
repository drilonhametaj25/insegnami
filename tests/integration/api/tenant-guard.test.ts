/**
 * Enforcement runtime dell'accesso tenant (trial scaduto, PAST_DUE,
 * CANCELLED, tenant disattivato): le route dati devono rispondere 402/403,
 * SUPERADMIN bypassa, e le route esenti (es. subscriptions) restano usabili
 * per permettere il pagamento.
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn(),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    student: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  },
}))

const { getAuth } = require('@/lib/auth')
const { getTenantAccessCached } = require('@/lib/tenant-access')

function adminSession(overrides: Record<string, any> = {}) {
  return {
    user: {
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      email: 'admin@example.com',
      ...overrides,
    },
  }
}

describe('blockIfTenantInaccessible (lib/tenant-guard)', () => {
  const { blockIfTenantInaccessible } = require('@/lib/tenant-guard')

  beforeEach(() => jest.clearAllMocks())

  it('returns null when the tenant verdict is ok', async () => {
    getTenantAccessCached.mockResolvedValue({ ok: true })
    expect(await blockIfTenantInaccessible(adminSession())).toBeNull()
  })

  it('returns 402 with the reason code for billing blocks', async () => {
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'trial-expired' })
    const res = await blockIfTenantInaccessible(adminSession())

    expect(res).not.toBeNull()
    expect(res!.status).toBe(402)
    const body = await res!.json()
    expect(body.code).toBe('trial-expired')
  })

  it('returns 403 for deactivated tenants', async () => {
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'tenant-inactive' })
    const res = await blockIfTenantInaccessible(adminSession())

    expect(res!.status).toBe(403)
  })

  it('bypasses SUPERADMIN entirely', async () => {
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'subscription-cancelled' })
    const res = await blockIfTenantInaccessible(adminSession({ role: 'SUPERADMIN' }))

    expect(res).toBeNull()
    expect(getTenantAccessCached).not.toHaveBeenCalled()
  })
})

describe('GET /api/students under tenant blocking', () => {
  const { GET } = require('@/app/api/students/route')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function request() {
    return { url: 'http://localhost/api/students?page=1&limit=10' } as any
  }

  it('returns 402 trial-expired for a blocked tenant', async () => {
    getAuth.mockResolvedValue(adminSession())
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'trial-expired' })

    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.code).toBe('trial-expired')
  })

  it('serves the request when the tenant is allowed', async () => {
    getAuth.mockResolvedValue(adminSession())
    getTenantAccessCached.mockResolvedValue({ ok: true })

    const res = await GET(request())

    expect(res.status).toBe(200)
  })

  it('lets SUPERADMIN through even when blocked', async () => {
    getAuth.mockResolvedValue(adminSession({ role: 'SUPERADMIN' }))
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'subscription-cancelled' })

    const res = await GET(request())

    expect(res.status).toBe(200)
  })
})

describe('requireAuth tenant access enforcement (lib/api-auth)', () => {
  const { requireAuth, AuthError } = require('@/lib/api-auth')

  beforeEach(() => jest.clearAllMocks())

  it('throws AuthError 402 when the tenant is blocked', async () => {
    getAuth.mockResolvedValue(adminSession())
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'subscription-past-due' })

    await expect(requireAuth()).rejects.toMatchObject({ status: 402 })
  })

  it('passes when the tenant is allowed', async () => {
    getAuth.mockResolvedValue(adminSession())
    getTenantAccessCached.mockResolvedValue({ ok: true })

    const ctx = await requireAuth()
    expect(ctx.tenantId).toBe('tenant-1')
  })

  it('skips the check when skipTenantAccessCheck is set (GDPR routes)', async () => {
    getAuth.mockResolvedValue(adminSession())
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'subscription-cancelled' })

    const ctx = await requireAuth({ skipTenantAccessCheck: true })

    expect(ctx.tenantId).toBe('tenant-1')
    expect(getTenantAccessCached).not.toHaveBeenCalled()
  })

  it('skips the check for SUPERADMIN', async () => {
    getAuth.mockResolvedValue(adminSession({ role: 'SUPERADMIN' }))
    getTenantAccessCached.mockResolvedValue({ ok: false, reason: 'subscription-cancelled' })

    const ctx = await requireAuth()

    expect(ctx.isSuperAdmin).toBe(true)
    expect(getTenantAccessCached).not.toHaveBeenCalled()
  })
})
