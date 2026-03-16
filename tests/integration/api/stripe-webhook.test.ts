import { POST } from '@/app/api/webhooks/stripe/route'

// Mock Stripe library
jest.mock('@/lib/stripe', () => ({
  constructWebhookEvent: jest.fn(),
  retrieveSubscription: jest.fn(),
}))

// Mock Redis
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    plan: { findUnique: jest.fn() },
    subscription: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tenant: { update: jest.fn() },
    payment: { update: jest.fn() },
    $transaction: jest.fn((fn: any) => fn({
      subscription: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      tenant: { update: jest.fn() },
    })),
  },
}))

// Mock sanitizeError
jest.mock('@/lib/api-middleware', () => ({
  sanitizeError: (err: any) => err?.message || 'Unknown error',
}))

const { constructWebhookEvent, retrieveSubscription } = require('@/lib/stripe')
const { redis } = require('@/lib/redis')
const { prisma } = require('@/lib/db')

function createRequest(body: string, signature: string | null = 'valid-sig') {
  const headers = new Map<string, string>()
  if (signature) headers.set('stripe-signature', signature)

  return {
    text: () => Promise.resolve(body),
    headers: {
      get: (key: string) => headers.get(key) || null,
    },
  } as any
}

describe('/api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redis.get.mockResolvedValue(null) // Not processed by default
    redis.set.mockResolvedValue('OK')
  })

  it('returns 400 when Stripe signature is missing', async () => {
    const req = createRequest('{}', null)
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing Stripe signature')
  })

  it('returns 400 when signature verification fails', async () => {
    constructWebhookEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const req = createRequest('{}', 'bad-sig')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Webhook signature verification failed')
  })

  it('returns 200 with deduplicated flag for already-processed events', async () => {
    redis.get.mockResolvedValue('processed')
    constructWebhookEvent.mockReturnValue({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: {} },
    })

    const req = createRequest('{}')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deduplicated).toBe(true)
    // Should NOT call prisma at all
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
  })

  it('handles checkout.session.completed with subscription mode', async () => {
    const mockEvent = {
      id: 'evt_sub_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          metadata: { tenantId: 'tenant-1' },
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    }
    constructWebhookEvent.mockReturnValue(mockEvent)
    retrieveSubscription.mockResolvedValue({
      status: 'active',
      items: { data: [{ price: { id: 'price_abc' } }] },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      trial_start: null,
      trial_end: null,
    })
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan-1',
      slug: 'professional',
      name: 'Professional',
    })

    const req = createRequest('{}')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(redis.set).toHaveBeenCalledWith('stripe:event:evt_sub_checkout', 'processed', 86400)
  })

  it('handles customer.subscription.updated — updates status', async () => {
    const mockEvent = {
      id: 'evt_sub_updated',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'past_due',
          items: { data: [{ price: { id: 'price_abc' } }] },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_end: null,
        },
      },
    }
    constructWebhookEvent.mockReturnValue(mockEvent)
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      tenantId: 'tenant-1',
      planId: 'plan-1',
    })
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan-1',
      slug: 'professional',
    })

    const req = createRequest('{}')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_123' },
        data: expect.objectContaining({
          status: 'PAST_DUE',
        }),
      })
    )
  })

  it('handles customer.subscription.deleted — sets CANCELLED', async () => {
    const mockEvent = {
      id: 'evt_sub_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_123' },
      },
    }
    constructWebhookEvent.mockReturnValue(mockEvent)
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      tenantId: 'tenant-1',
    })

    const req = createRequest('{}')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('acknowledges unknown event types with 200', async () => {
    constructWebhookEvent.mockReturnValue({
      id: 'evt_unknown',
      type: 'some.unknown.event',
      data: { object: {} },
    })

    const req = createRequest('{}')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(redis.set).toHaveBeenCalledWith('stripe:event:evt_unknown', 'processed', 86400)
  })
})
