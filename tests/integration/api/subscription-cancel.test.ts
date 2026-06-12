import { POST as cancelPost } from '@/app/api/subscriptions/cancel/route'
import { POST as reactivatePost } from '@/app/api/subscriptions/reactivate/route'
import { POST as checkoutPost } from '@/app/api/subscriptions/checkout/route'

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findUnique: jest.fn(), update: jest.fn() },
    tenant: { findUnique: jest.fn(), update: jest.fn() },
    plan: { findUnique: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))

// Mock Stripe helpers
jest.mock('@/lib/stripe', () => ({
  cancelSubscription: jest.fn(),
  reactivateSubscription: jest.fn(),
  getOrCreateCustomer: jest.fn(),
  createSubscriptionCheckoutSession: jest.fn(),
}))

// Mock billing mode (default: Stripe reale; i test dev-billing lo sovrascrivono)
jest.mock('@/lib/billing/billing-mode', () => ({
  isDevBilling: jest.fn(() => false),
  TRIAL_DAYS: 14,
}))

// Mock dev billing
jest.mock('@/lib/billing/dev-billing', () => ({
  devCancelSubscription: jest.fn(),
  devReactivateSubscription: jest.fn(),
  devActivateSubscription: jest.fn(),
}))

// Mock cache accesso tenant
jest.mock('@/lib/tenant-access', () => ({
  invalidateTenantAccessCache: jest.fn().mockResolvedValue(undefined),
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const {
  cancelSubscription,
  reactivateSubscription,
  getOrCreateCustomer,
  createSubscriptionCheckoutSession,
} = require('@/lib/stripe')
const { isDevBilling } = require('@/lib/billing/billing-mode')
const {
  devCancelSubscription,
  devReactivateSubscription,
} = require('@/lib/billing/dev-billing')
const { invalidateTenantAccessCache } = require('@/lib/tenant-access')

function createRequest(body?: any) {
  return {
    url: 'http://localhost:3000/api/subscriptions/test',
    method: 'POST',
    json: () => Promise.resolve(body ?? {}),
    headers: { get: () => null },
  } as any
}

const adminSession = {
  user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

const activeSubscription = {
  id: 'sub-db-1',
  tenantId: 'tenant-1',
  planId: 'plan-1',
  stripeSubscriptionId: 'sub_stripe_123',
  stripeCustomerId: 'cus_123',
  status: 'ACTIVE',
  currentPeriodStart: new Date('2026-06-01'),
  currentPeriodEnd: new Date('2026-07-01'),
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  plan: { id: 'plan-1', slug: 'professional', name: 'Professional' },
}

describe('Subscription cancel/reactivate + trial abuse guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue(adminSession)
    isDevBilling.mockReturnValue(false)
  })

  // ========================================
  // POST /api/subscriptions/cancel
  // ========================================
  describe('POST /api/subscriptions/cancel', () => {
    it('returns 400 when the tenant has no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null)

      const response = await cancelPost()
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(cancelSubscription).not.toHaveBeenCalled()
    })

    it('cancels at period end via Stripe and updates the DB', async () => {
      prisma.subscription.findUnique.mockResolvedValue(activeSubscription)
      cancelSubscription.mockResolvedValue({ id: 'sub_stripe_123', cancel_at_period_end: true })
      prisma.subscription.update.mockResolvedValue({
        ...activeSubscription,
        cancelAtPeriodEnd: true,
      })

      const response = await cancelPost()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subscription.cancelAtPeriodEnd).toBe(true)
      // Annullamento a fine periodo (non immediato) su Stripe
      expect(cancelSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub_stripe_123',
        cancelAtPeriodEnd: true,
      })
      // Stato riflesso subito in DB (il webhook resta la fonte canonica)
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          data: expect.objectContaining({ cancelAtPeriodEnd: true }),
        })
      )
      expect(invalidateTenantAccessCache).toHaveBeenCalledWith('tenant-1')
    })

    it('rejects non-admin roles with 403', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'user-2', email: 't@scuola.it', role: 'TEACHER', tenantId: 'tenant-1' },
      })

      const response = await cancelPost()

      expect(response.status).toBe(403)
      expect(prisma.subscription.findUnique).not.toHaveBeenCalled()
      expect(cancelSubscription).not.toHaveBeenCalled()
    })

    it('uses devCancelSubscription (and not Stripe) in dev billing mode', async () => {
      isDevBilling.mockReturnValue(true)
      prisma.subscription.findUnique.mockResolvedValue({
        ...activeSubscription,
        stripeSubscriptionId: 'dev_sub_tenant-1',
      })
      devCancelSubscription.mockResolvedValue({
        ...activeSubscription,
        cancelAtPeriodEnd: true,
      })

      const response = await cancelPost()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(devCancelSubscription).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        cancelAtPeriodEnd: true,
      })
      expect(cancelSubscription).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // POST /api/subscriptions/reactivate
  // ========================================
  describe('POST /api/subscriptions/reactivate', () => {
    it('reactivates a subscription pending cancellation', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...activeSubscription,
        cancelAtPeriodEnd: true,
        cancelledAt: new Date('2026-06-10'),
      })
      reactivateSubscription.mockResolvedValue({ id: 'sub_stripe_123', cancel_at_period_end: false })
      prisma.subscription.update.mockResolvedValue({
        ...activeSubscription,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      })

      const response = await reactivatePost()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subscription.cancelAtPeriodEnd).toBe(false)
      expect(reactivateSubscription).toHaveBeenCalledWith('sub_stripe_123')
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          data: expect.objectContaining({ cancelAtPeriodEnd: false, cancelledAt: null }),
        })
      )
      expect(invalidateTenantAccessCache).toHaveBeenCalledWith('tenant-1')
    })

    it('returns 400 when there is no subscription to reactivate', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null)

      const response = await reactivatePost()

      expect(response.status).toBe(400)
      expect(reactivateSubscription).not.toHaveBeenCalled()
    })

    it('rejects non-admin roles with 403', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'user-2', email: 't@scuola.it', role: 'TEACHER', tenantId: 'tenant-1' },
      })

      const response = await reactivatePost()

      expect(response.status).toBe(403)
      expect(reactivateSubscription).not.toHaveBeenCalled()
    })

    it('uses devReactivateSubscription (and not Stripe) in dev billing mode', async () => {
      isDevBilling.mockReturnValue(true)
      prisma.subscription.findUnique.mockResolvedValue({
        ...activeSubscription,
        stripeSubscriptionId: 'dev_sub_tenant-1',
        cancelAtPeriodEnd: true,
      })
      devReactivateSubscription.mockResolvedValue({
        ...activeSubscription,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      })

      const response = await reactivatePost()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(devReactivateSubscription).toHaveBeenCalledWith({ tenantId: 'tenant-1' })
      expect(reactivateSubscription).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // Trial abuse guard su POST /api/subscriptions/checkout
  // ========================================
  describe('POST /api/subscriptions/checkout — trial abuse guard', () => {
    const plan = {
      id: 'plan-1',
      slug: 'professional',
      name: 'Professional',
      isActive: true,
      interval: 'MONTHLY',
      stripePriceId: 'price_pro',
    }
    const user = {
      id: 'user-1',
      email: 'admin@scuola.it',
      firstName: 'Anna',
      lastName: 'Rossi',
    }

    beforeEach(() => {
      prisma.plan.findUnique.mockResolvedValue(plan)
      prisma.user.findUnique.mockResolvedValue(user)
      prisma.subscription.findUnique.mockResolvedValue(null)
      getOrCreateCustomer.mockResolvedValue({ id: 'cus_123' })
      createSubscriptionCheckoutSession.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.test/cs_123',
      })
    })

    it('passes trialDays 0 when tenant.trialUntil is in the past', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
        trialUntil: new Date(Date.now() - 5 * 86400000), // trial scaduto 5 giorni fa
      })

      const response = await checkoutPost(createRequest({ planId: 'plan-1' }))

      expect(response.status).toBe(200)
      expect(createSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ trialDays: 0 })
      )
    })

    it('passes the residual trial days when tenant.trialUntil is in the future', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
        // ~5 giorni residui (ceil → 5)
        trialUntil: new Date(Date.now() + 5 * 86400000 - 3600000),
      })

      const response = await checkoutPost(createRequest({ planId: 'plan-1' }))

      expect(response.status).toBe(200)
      expect(createSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ trialDays: 5 })
      )
    })

    it('passes trialDays 0 when the tenant has no trialUntil (no fixed 14 days)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
        trialUntil: null,
      })

      const response = await checkoutPost(createRequest({ planId: 'plan-1' }))

      expect(response.status).toBe(200)
      expect(createSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ trialDays: 0 })
      )
    })

    it('blocks checkout with 400 when a TRIALING subscription already exists', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
        trialUntil: new Date(Date.now() + 10 * 86400000),
      })
      prisma.subscription.findUnique.mockResolvedValue({
        ...activeSubscription,
        status: 'TRIALING',
      })

      const response = await checkoutPost(createRequest({ planId: 'plan-1' }))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    })

    it('still blocks checkout with 400 when an ACTIVE subscription exists', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
        trialUntil: null,
      })
      prisma.subscription.findUnique.mockResolvedValue(activeSubscription)

      const response = await checkoutPost(createRequest({ planId: 'plan-1' }))

      expect(response.status).toBe(400)
      expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    })
  })
})
