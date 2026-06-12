/**
 * Difesa in profondità su POST /api/subscriptions/change-plan (A3.3):
 * se subscription.stripeCustomerId e tenant.stripeCustomerId divergono,
 * la richiesta va rifiutata con 409 — il cambio piano agirebbe su un
 * customer Stripe che non appartiene (più) al tenant.
 */

import { POST } from '@/app/api/subscriptions/change-plan/route'

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
    plan: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  updateSubscriptionPlan: jest.fn(),
  retrieveSubscription: jest.fn(),
}))

jest.mock('@/lib/billing/billing-mode', () => ({
  isDevBilling: jest.fn(() => false),
}))

jest.mock('@/lib/billing/dev-billing', () => ({
  devChangePlan: jest.fn(),
}))

jest.mock('@/lib/billing/plan-change', () => ({
  validatePlanChange: jest.fn(() => Promise.resolve({ allowed: true, violations: [] })),
  getActiveUsage: jest.fn(),
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const { updateSubscriptionPlan, retrieveSubscription } = require('@/lib/stripe')

function createRequest(body: any) {
  return {
    json: () => Promise.resolve(body),
  } as any
}

describe('POST /api/subscriptions/change-plan — ownership stripeCustomerId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-1' },
    })
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      name: 'Pro',
      price: 49,
      interval: 'month',
      isActive: true,
      stripePriceId: 'price_pro',
      maxStudents: 100,
      maxTeachers: 20,
      maxClasses: 30,
    })
    updateSubscriptionPlan.mockResolvedValue({ id: 'sub_stripe_1' })
    retrieveSubscription.mockResolvedValue({
      items: { data: [{ current_period_end: 1750000000 }] },
    })
  })

  it('409 quando subscription.stripeCustomerId ≠ tenant.stripeCustomerId', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      tenantId: 'tenant-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeCustomerId: 'cus_AAA',
      plan: { slug: 'base' },
    })
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_BBB',
    })

    const response = await POST(createRequest({ targetPlanSlug: 'pro' }))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBeDefined()
    // Non deve toccare Stripe
    expect(updateSubscriptionPlan).not.toHaveBeenCalled()
  })

  it('procede quando i due stripeCustomerId coincidono', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      tenantId: 'tenant-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeCustomerId: 'cus_AAA',
      plan: { slug: 'base' },
    })
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_AAA',
    })

    const response = await POST(createRequest({ targetPlanSlug: 'pro' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(updateSubscriptionPlan).toHaveBeenCalledWith({
      subscriptionId: 'sub_stripe_1',
      newPriceId: 'price_pro',
    })
  })

  it('procede quando il tenant non ha ancora stripeCustomerId (nessun falso positivo)', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      tenantId: 'tenant-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeCustomerId: 'cus_AAA',
      plan: { slug: 'base' },
    })
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: null,
    })

    const response = await POST(createRequest({ targetPlanSlug: 'pro' }))
    expect(response.status).toBe(200)
  })
})
