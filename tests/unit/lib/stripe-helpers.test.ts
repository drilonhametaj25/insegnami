/**
 * Helper Stripe (lib/stripe):
 * - updateSubscriptionPlan: con add-on attivi sulla subscription, items.data[0]
 *   può essere l'item dell'ADD-ON. Il fix deve aggiornare l'item del PIANO
 *   (quello il cui price.metadata NON ha addonType), con fallback al primo item.
 * - createCheckoutSession (one-time): deve propagare payment_intent_data.metadata
 *   (platform, paymentId, tenantId) — senza, i webhook payment_intent.payment_failed
 *   e charge.refunded non trovano mai metadata.paymentId sui pagamenti reali.
 *
 * Il pacchetto 'stripe' è mockato con una classe fake: lib/stripe istanzia il
 * client in modo lazy leggendo STRIPE_SECRET_KEY.
 */

jest.mock('stripe', () => {
  // Mock definiti DENTRO la factory (jest.mock è hoistato); esposti via __mocks.
  const subscriptions = {
    retrieve: jest.fn(),
    update: jest.fn(),
  };
  const checkout = {
    sessions: {
      create: jest.fn(),
    },
  };
  class FakeStripe {
    subscriptions = subscriptions;
    checkout = checkout;
  }
  (FakeStripe as any).__mocks = { subscriptions, checkout };
  return FakeStripe;
});

import {
  updateSubscriptionPlan,
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  PLATFORM_METADATA,
} from '@/lib/stripe';

const { subscriptions: mockSubscriptions, checkout: mockCheckout } =
  (require('stripe') as any).__mocks;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateSubscriptionPlan', () => {
  it('aggiorna l\'item del PIANO anche quando il primo item è un add-on', async () => {
    // items.data[0] è l'add-on (price.metadata.addonType presente)
    mockSubscriptions.retrieve.mockResolvedValue({
      id: 'sub_1',
      items: {
        data: [
          {
            id: 'si_addon',
            price: { id: 'price_addon', metadata: { addonType: 'EXTRA_STUDENTS' } },
          },
          {
            id: 'si_plan',
            price: { id: 'price_plan_old', metadata: {} },
          },
        ],
      },
    });
    mockSubscriptions.update.mockResolvedValue({ id: 'sub_1' });

    await updateSubscriptionPlan({ subscriptionId: 'sub_1', newPriceId: 'price_plan_new' });

    // Retrieve con expand del price: senza, metadata non è disponibile
    expect(mockSubscriptions.retrieve).toHaveBeenCalledWith('sub_1', {
      expand: ['items.data.price'],
    });
    // Update sull'item del piano, NON sull'add-on
    expect(mockSubscriptions.update).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_plan', price: 'price_plan_new' }],
      proration_behavior: 'create_prorations',
    });
  });

  it('fallback su items.data[0] se nessun item è privo di addonType', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({
      id: 'sub_2',
      items: {
        data: [
          {
            id: 'si_only_addon',
            price: { id: 'price_addon', metadata: { addonType: 'EXTRA_TEACHERS' } },
          },
        ],
      },
    });
    mockSubscriptions.update.mockResolvedValue({ id: 'sub_2' });

    await updateSubscriptionPlan({ subscriptionId: 'sub_2', newPriceId: 'price_new' });

    expect(mockSubscriptions.update).toHaveBeenCalledWith('sub_2', {
      items: [{ id: 'si_only_addon', price: 'price_new' }],
      proration_behavior: 'create_prorations',
    });
  });

  it('lancia errore se la subscription non ha items', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({
      id: 'sub_3',
      items: { data: [] },
    });

    await expect(
      updateSubscriptionPlan({ subscriptionId: 'sub_3', newPriceId: 'price_new' })
    ).rejects.toThrow('No subscription item found');
    expect(mockSubscriptions.update).not.toHaveBeenCalled();
  });
});

describe('createCheckoutSession (one-time)', () => {
  it('propaga payment_intent_data.metadata con paymentId e tenantId', async () => {
    mockCheckout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe' });

    await createCheckoutSession({
      paymentId: 'pay-123',
      studentName: 'Mario Rossi',
      amount: 5000,
      description: 'Retta mensile',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
      metadata: { tenantId: 'tenant-1' },
    });

    expect(mockCheckout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_intent_data: {
          metadata: {
            ...PLATFORM_METADATA,
            paymentId: 'pay-123',
            tenantId: 'tenant-1',
          },
        },
        metadata: expect.objectContaining({ paymentId: 'pay-123', tenantId: 'tenant-1' }),
      })
    );
  });

  it('tenantId vuoto nel payment intent se non presente nei metadata', async () => {
    mockCheckout.sessions.create.mockResolvedValue({ id: 'cs_2', url: 'https://stripe' });

    await createCheckoutSession({
      paymentId: 'pay-456',
      studentName: 'Mario Rossi',
      amount: 5000,
      description: 'Retta mensile',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    const params = mockCheckout.sessions.create.mock.calls[0][0];
    expect(params.payment_intent_data.metadata.paymentId).toBe('pay-456');
    expect(params.payment_intent_data.metadata.tenantId).toBe('');
  });
});

describe('createSubscriptionCheckoutSession', () => {
  const baseArgs = {
    customerId: 'cus_1',
    priceId: 'price_plan',
    tenantId: 'tenant-1',
    successUrl: 'https://app/success',
    cancelUrl: 'https://app/cancel',
  };

  it('passa trial_period_days quando il trial residuo è positivo', async () => {
    mockCheckout.sessions.create.mockResolvedValue({ id: 'cs_sub_1' });

    await createSubscriptionCheckoutSession({ ...baseArgs, trialDays: 7 });

    const params = mockCheckout.sessions.create.mock.calls[0][0];
    expect(params.subscription_data.trial_period_days).toBe(7);
  });

  it('OMETTE trial_period_days con trial esaurito (Stripe rifiuta valori < 1)', async () => {
    mockCheckout.sessions.create.mockResolvedValue({ id: 'cs_sub_2' });

    await createSubscriptionCheckoutSession({ ...baseArgs, trialDays: 0 });

    const params = mockCheckout.sessions.create.mock.calls[0][0];
    expect(params.subscription_data).not.toHaveProperty('trial_period_days');
    // I metadata platform/tenant restano
    expect(params.subscription_data.metadata).toEqual({
      ...PLATFORM_METADATA,
      tenantId: 'tenant-1',
    });
  });
});
