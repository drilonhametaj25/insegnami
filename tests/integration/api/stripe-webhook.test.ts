import { POST } from '@/app/api/webhooks/stripe/route'

// Mock Stripe library
jest.mock('@/lib/stripe', () => ({
  constructWebhookEvent: jest.fn(),
  retrieveSubscription: jest.fn(),
  PLATFORM_METADATA: { platform: 'InsegnaMi' },
}))

// Mock Redis
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(true),
    getJSON: jest.fn().mockResolvedValue(null),
    setJSON: jest.fn().mockResolvedValue(true),
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
    tenant: { update: jest.fn(), findUnique: jest.fn() },
    payment: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((fn: any) => fn({
      subscription: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      tenant: { update: jest.fn() },
      tenantAddon: { updateMany: jest.fn() },
    })),
  },
}))

// Mock add-on reconciliation (esercitata dai test dedicati in stripe-addons)
jest.mock('@/lib/billing/stripe-addons', () => ({
  reconcileAddonItems: jest.fn().mockResolvedValue(undefined),
}))

// Mock notifiche commerciali (esercitate dai test dedicati in billing-notifications)
jest.mock('@/lib/notifications/billing-notifications', () => ({
  notifyTenantAdmins: jest.fn(),
}))

// Mock sanitizeError
jest.mock('@/lib/api-middleware', () => ({
  sanitizeError: (err: any) => err?.message || 'Unknown error',
}))

const { constructWebhookEvent, retrieveSubscription } = require('@/lib/stripe')
const { redis } = require('@/lib/redis')
const { prisma } = require('@/lib/db')
const { notifyTenantAdmins } = require('@/lib/notifications/billing-notifications')

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
    // Default: nessun riscontro in DB (i singoli test sovrascrivono)
    prisma.tenant.findUnique.mockResolvedValue(null)
    prisma.subscription.findUnique.mockResolvedValue(null)
    prisma.payment.findUnique.mockResolvedValue(null)
    // mockResolvedValue (non solo clear) per annullare eventuali mockRejectedValue dei test precedenti
    notifyTenantAdmins.mockResolvedValue(1)
    prisma.payment.updateMany.mockResolvedValue({ count: 1 })
    prisma.subscription.update.mockResolvedValue({})
    prisma.subscription.updateMany.mockResolvedValue({ count: 1 })
    prisma.tenant.update.mockResolvedValue({})
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
          metadata: { platform: 'InsegnaMi', tenantId: 'tenant-1' },
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

  // ========================================
  // Platform filter (account Stripe condiviso tra più applicativi)
  // ========================================
  describe('platform filter', () => {
    it('ignores checkout events from another platform without touching the DB', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_foreign_checkout',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            metadata: { platform: 'RisparmiAmi', tenantId: 'tenant-other-app' },
            subscription: 'sub_foreign',
            customer: 'cus_foreign',
          },
        },
      })

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ignored).toBe('foreign-platform')
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(prisma.subscription.upsert).not.toHaveBeenCalled()
      expect(prisma.payment.update).not.toHaveBeenCalled()
      // L'evento estraneo viene marcato processed per non riesaminarlo
      expect(redis.set).toHaveBeenCalledWith('stripe:event:evt_foreign_checkout', 'processed', 86400)
    })

    it('ignores subscription events with no metadata and no DB match', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_foreign_sub',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_unknown',
            customer: 'cus_unknown',
            status: 'active',
            metadata: {},
            items: { data: [{ price: { id: 'price_foreign' } }] },
          },
        },
      })

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ignored).toBe('foreign-platform')
      expect(prisma.subscription.update).not.toHaveBeenCalled()
      expect(prisma.subscription.upsert).not.toHaveBeenCalled()
    })

    it('still processes subscription events without metadata when the customer is ours (backfill)', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_backfill_sub',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_new_unknown',
            customer: 'cus_ours',
            status: 'active',
            metadata: {},
            items: { data: [{ price: { id: 'price_abc' } }] },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            canceled_at: null,
            trial_start: null,
            trial_end: null,
          },
        },
      })
      // Subscription non in DB, ma il customer appartiene a un nostro tenant
      prisma.subscription.findUnique.mockResolvedValue(null)
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' })
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan-1', slug: 'professional' })
      prisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-new',
        tenantId: 'tenant-1',
        planId: 'plan-1',
      })

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      expect(data.ignored).toBeUndefined()
      expect(prisma.subscription.upsert).toHaveBeenCalled()
    })

    it('ignores invoice events whose subscription/customer is not ours', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_foreign_invoice',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_foreign',
            subscription: 'sub_foreign',
            customer: 'cus_foreign',
          },
        },
      })

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ignored).toBe('foreign-platform')
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled()
    })

    it('ignores payment_intent events without a known paymentId', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_foreign_pi',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_foreign',
            metadata: { paymentId: 'payment-other-app' },
          },
        },
      })
      prisma.payment.findUnique.mockResolvedValue(null)

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ignored).toBe('foreign-platform')
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // Semantica errori: 500 su errori genuini (Stripe ritenta)
  // ========================================
  describe('error semantics', () => {
    it('returns 500 and does NOT mark the event processed when handling fails', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_ours_failing',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            metadata: { platform: 'InsegnaMi', tenantId: 'tenant-1' },
            items: { data: [{ price: { id: 'price_abc' } }] },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            canceled_at: null,
            trial_end: null,
          },
        },
      })
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-1',
        tenantId: 'tenant-1',
        planId: 'plan-1',
      })
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan-1', slug: 'professional' })
      prisma.subscription.update.mockRejectedValue(new Error('DB down'))

      const req = createRequest('{}')
      const response = await POST(req)

      expect(response.status).toBe(500)
      expect(redis.set).not.toHaveBeenCalledWith(
        'stripe:event:evt_ours_failing',
        'processed',
        86400
      )
    })

    it('still returns 400 for invalid signatures (no retry storm)', async () => {
      constructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const req = createRequest('{}', 'bad-sig')
      const response = await POST(req)

      expect(response.status).toBe(400)
    })
  })

  // ========================================
  // trial_will_end → promemoria fine prova agli admin
  // ========================================
  describe('customer.subscription.trial_will_end', () => {
    function trialWillEndEvent(overrides: Record<string, any> = {}) {
      return {
        id: 'evt_trial_will_end',
        type: 'customer.subscription.trial_will_end',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            metadata: {},
            trial_end: 1702592000,
            ...overrides,
          },
        },
      }
    }

    it('notifica gli admin del tenant quando la subscription è nostra', async () => {
      constructWebhookEvent.mockReturnValue(trialWillEndEvent())
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-1',
        tenantId: 'tenant-1',
      })

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      expect(notifyTenantAdmins).toHaveBeenCalledTimes(1)
      expect(notifyTenantAdmins).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          title: expect.stringContaining('prova'),
          actionUrl: '/dashboard/billing',
        })
      )
    })

    it('ignora subscription sconosciute (foreign) senza notificare', async () => {
      constructWebhookEvent.mockReturnValue(trialWillEndEvent({ id: 'sub_unknown', customer: 'cus_unknown' }))
      prisma.subscription.findUnique.mockResolvedValue(null)
      prisma.tenant.findUnique.mockResolvedValue(null)

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ignored).toBe('foreign-platform')
      expect(notifyTenantAdmins).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // Email transazionali commerciali (fire-and-forget)
  // ========================================
  describe('commercial notifications', () => {
    it('checkout.session.completed (subscription) → notifica attivazione una sola volta', async () => {
      constructWebhookEvent.mockReturnValue({
        id: 'evt_sub_checkout_notify',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            metadata: { platform: 'InsegnaMi', tenantId: 'tenant-1' },
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      })
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

      expect(response.status).toBe(200)
      expect(notifyTenantAdmins).toHaveBeenCalledTimes(1)
      expect(notifyTenantAdmins).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          title: expect.stringContaining('Professional'),
        })
      )
    })

    function subscriptionUpdatedEvent() {
      return {
        id: 'evt_sub_updated_notify',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            metadata: { platform: 'InsegnaMi', tenantId: 'tenant-1' },
            items: { data: [{ price: { id: 'price_abc' } }] },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            canceled_at: null,
            trial_end: null,
          },
        },
      }
    }

    it('subscription.updated con lo stesso piano → NESSUNA notifica', async () => {
      constructWebhookEvent.mockReturnValue(subscriptionUpdatedEvent())
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-1',
        tenantId: 'tenant-1',
        planId: 'plan-1',
      })
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan-1',
        slug: 'professional',
        name: 'Professional',
      })

      const req = createRequest('{}')
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(notifyTenantAdmins).not.toHaveBeenCalled()
    })

    it('subscription.updated con piano diverso → notifica "Piano aggiornato"', async () => {
      constructWebhookEvent.mockReturnValue(subscriptionUpdatedEvent())
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-1',
        tenantId: 'tenant-1',
        planId: 'plan-1', // piano attuale in DB...
      })
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan-2', // ...diverso da quello risolto dal price Stripe
        slug: 'enterprise',
        name: 'Enterprise',
      })

      const req = createRequest('{}')
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(notifyTenantAdmins).toHaveBeenCalledTimes(1)
      expect(notifyTenantAdmins).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          title: expect.stringContaining('Enterprise'),
        })
      )
    })

    function invoiceFailedEvent() {
      return {
        id: 'evt_invoice_failed_notify',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      }
    }

    it('invoice.payment_failed → notifica gli admin con actionUrl billing', async () => {
      constructWebhookEvent.mockReturnValue(invoiceFailedEvent())
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-1',
        tenantId: 'tenant-1',
      })
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 })

      const req = createRequest('{}')
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(notifyTenantAdmins).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          title: expect.stringContaining('Pagamento non riuscito'),
          actionUrl: '/dashboard/billing',
        })
      )
    })

    it('il fallimento della notifica NON trasforma la risposta in 500 (fire-and-forget)', async () => {
      constructWebhookEvent.mockReturnValue(invoiceFailedEvent())
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-1',
        tenantId: 'tenant-1',
      })
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 })
      notifyTenantAdmins.mockRejectedValue(new Error('SMTP down'))

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      // L'evento viene comunque marcato processed: niente retry storm
      expect(redis.set).toHaveBeenCalledWith(
        'stripe:event:evt_invoice_failed_notify',
        'processed',
        86400
      )
    })
  })

  // ========================================
  // One-time payment: update scoped per tenant
  // ========================================
  describe('one-time payment scoping', () => {
    function oneTimeCheckoutEvent(metadata: Record<string, string>) {
      return {
        id: 'evt_onetime_checkout',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'payment',
            metadata: { platform: 'InsegnaMi', ...metadata },
            payment_intent: 'pi_123',
          },
        },
      }
    }

    it('con tenantId nei metadata → updateMany scoped su id E tenantId', async () => {
      constructWebhookEvent.mockReturnValue(
        oneTimeCheckoutEvent({ paymentId: 'payment-1', tenantId: 'tenant-1' })
      )
      prisma.payment.updateMany.mockResolvedValue({ count: 1 })

      const req = createRequest('{}')
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1', tenantId: 'tenant-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        })
      )
      // Niente update non-scoped: il vecchio prisma.payment.update va in pensione
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })

    it('senza tenantId nei metadata → updateMany solo per id', async () => {
      constructWebhookEvent.mockReturnValue(oneTimeCheckoutEvent({ paymentId: 'payment-1' }))
      prisma.payment.updateMany.mockResolvedValue({ count: 1 })

      const req = createRequest('{}')
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
        })
      )
    })

    it('updateMany count 0 (payment inesistente o tenant mismatch) → 200 senza throw', async () => {
      constructWebhookEvent.mockReturnValue(
        oneTimeCheckoutEvent({ paymentId: 'payment-ghost', tenantId: 'tenant-other' })
      )
      prisma.payment.updateMany.mockResolvedValue({ count: 0 })

      const req = createRequest('{}')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      // Ack: l'evento viene marcato processed, Stripe non deve ritentare
      expect(redis.set).toHaveBeenCalledWith(
        'stripe:event:evt_onetime_checkout',
        'processed',
        86400
      )
    })
  })
})
