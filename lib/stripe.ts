import Stripe from 'stripe';

// Identifica la piattaforma di provenienza su ogni entità Stripe creata
// (customer, subscription, product, price, checkout session): utile quando
// lo stesso account Stripe serve più prodotti SaaS.
export const PLATFORM_METADATA = { platform: 'InsegnaMi' } as const;

// Initialize Stripe lazily to avoid build-time errors
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any, // Use any to bypass strict type check
      typescript: true,
    });
  }
  return stripeInstance;
}

// Export stripe getter for backwards compatibility
export const stripe = {
  get checkout() {
    return getStripeClient().checkout;
  },
  get webhooks() {
    return getStripeClient().webhooks;
  },
  get paymentIntents() {
    return getStripeClient().paymentIntents;
  },
  get refunds() {
    return getStripeClient().refunds;
  },
  get customers() {
    return getStripeClient().customers;
  },
  get subscriptions() {
    return getStripeClient().subscriptions;
  },
  get subscriptionItems() {
    return getStripeClient().subscriptionItems;
  },
  get billingPortal() {
    return getStripeClient().billingPortal;
  },
  get invoices() {
    return getStripeClient().invoices;
  },
  get prices() {
    return getStripeClient().prices;
  },
  get products() {
    return getStripeClient().products;
  },
};

// Helper to create checkout session
export async function createCheckoutSession({
  paymentId,
  studentName,
  amount,
  description,
  successUrl,
  cancelUrl,
  metadata,
}: {
  paymentId: string;
  studentName: string;
  amount: number; // in cents
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Pagamento - ${studentName}`,
            description: description,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...PLATFORM_METADATA,
      paymentId,
      ...metadata,
    },
    // I metadata della session NON si propagano al PaymentIntent: senza questo
    // blocco i webhook payment_intent.payment_failed e charge.refunded non
    // trovano mai metadata.paymentId sui pagamenti reali.
    payment_intent_data: {
      metadata: {
        ...PLATFORM_METADATA,
        paymentId,
        tenantId: metadata?.tenantId ?? '',
      },
    },
  });

  return session;
}

// Helper to construct webhook event
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// Helper to retrieve payment intent
export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

// Helper to create refund
export async function createRefund({
  paymentIntentId,
  amount,
  reason,
}: {
  paymentIntentId: string;
  amount?: number; // in cents, if not provided, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount,
    reason,
  });
}

// ========================================
// SUBSCRIPTION HELPERS
// ========================================

// Create or retrieve a Stripe customer
export async function getOrCreateCustomer({
  email,
  name,
  tenantId,
  existingCustomerId,
}: {
  email: string;
  name: string;
  tenantId: string;
  existingCustomerId?: string | null;
}): Promise<Stripe.Customer> {
  // If we have an existing customer ID, retrieve it
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) {
        return customer as Stripe.Customer;
      }
    } catch {
      // Customer doesn't exist, create a new one
    }
  }

  // Create new customer
  return stripe.customers.create({
    email,
    name,
    metadata: {
      ...PLATFORM_METADATA,
      tenantId,
    },
  });
}

// Create subscription checkout session
export async function createSubscriptionCheckoutSession({
  customerId,
  priceId,
  tenantId,
  successUrl,
  cancelUrl,
  trialDays = 14,
}: {
  customerId: string;
  priceId: string;
  tenantId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      // Stripe rifiuta trial_period_days < 1: con trial esaurito (0) il
      // campo va omesso del tutto, la subscription parte subito a pagamento
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      metadata: {
        ...PLATFORM_METADATA,
        tenantId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...PLATFORM_METADATA,
      tenantId,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
  });

  return session;
}

// Create billing portal session
export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// Retrieve subscription
export async function retrieveSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method', 'items.data.price.product'],
  });
}

// Cancel subscription
export async function cancelSubscription({
  subscriptionId,
  cancelAtPeriodEnd = true,
}: {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
}): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return stripe.subscriptions.cancel(subscriptionId);
  }
}

// Reactivate subscription (if cancelled but not yet expired)
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// Update subscription to new price/plan
export async function updateSubscriptionPlan({
  subscriptionId,
  newPriceId,
  newYearlyPriceId,
}: {
  subscriptionId: string;
  /** Prezzo MENSILE del piano di destinazione. */
  newPriceId: string;
  /** Prezzo ANNUALE del piano di destinazione (Plan.stripeYearlyPriceId). */
  newYearlyPriceId?: string | null;
}): Promise<Stripe.Subscription> {
  // Con add-on attivi la subscription ha più items e items.data[0] può essere
  // l'item dell'ADD-ON: aggiornare quello cambierebbe il prezzo sbagliato.
  // Espandiamo il price per leggere metadata.addonType e scegliere l'item del
  // PIANO (quello SENZA addonType); fallback al primo item se nessuno matcha.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  const planItem =
    subscription.items.data.find(
      (item) => !(item.price as Stripe.Price | undefined)?.metadata?.addonType
    ) ?? subscription.items.data[0];
  const itemId = planItem?.id;

  if (!itemId) {
    throw new Error('No subscription item found');
  }

  // Il cambio piano preserva l'intervallo di fatturazione corrente: chi è
  // sull'annuale passa al prezzo annuale del piano di destinazione, non al
  // mensile (che cambierebbe silenziosamente la cadenza di addebito).
  const isYearly =
    (planItem.price as Stripe.Price | undefined)?.recurring?.interval === 'year';
  if (isYearly && !newYearlyPriceId) {
    throw new Error(
      'Prezzo annuale non configurato per il piano di destinazione: esegui la sync Stripe.'
    );
  }
  const targetPriceId = isYearly ? newYearlyPriceId! : newPriceId;

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: itemId,
        price: targetPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}

// Get all active prices
export async function getActivePrices(): Promise<Stripe.Price[]> {
  const prices = await stripe.prices.list({
    active: true,
    expand: ['data.product'],
    type: 'recurring',
  });
  return prices.data;
}

// ========================================
// PLAN/PRODUCT MANAGEMENT (SuperAdmin)
// ========================================

// Create a new Stripe product and price
export async function createStripeProduct({
  name,
  description,
  priceAmount, // in cents
  interval,
  metadata,
}: {
  name: string;
  description?: string;
  priceAmount: number;
  interval: 'month' | 'year';
  metadata?: Record<string, string>;
}): Promise<{ product: Stripe.Product; price: Stripe.Price }> {
  // Create product first
  const product = await stripe.products.create({
    name,
    description,
    metadata: {
      ...PLATFORM_METADATA,
      ...metadata,
      createdBy: 'superadmin',
    },
  });

  // Create price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: priceAmount,
    currency: 'eur',
    recurring: {
      interval,
    },
    metadata: { ...PLATFORM_METADATA, ...metadata },
  });

  return { product, price };
}

// Update Stripe product metadata (name, description)
export async function updateStripeProduct({
  productId,
  name,
  description,
  active,
}: {
  productId: string;
  name?: string;
  description?: string;
  active?: boolean;
}): Promise<Stripe.Product> {
  const updateData: Stripe.ProductUpdateParams = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (active !== undefined) updateData.active = active;

  return stripe.products.update(productId, updateData);
}

// Create new price for existing product (for price changes)
export async function createNewPrice({
  productId,
  priceAmount,
  interval,
  metadata,
}: {
  productId: string;
  priceAmount: number;
  interval: 'month' | 'year';
  metadata?: Record<string, string>;
}): Promise<Stripe.Price> {
  return stripe.prices.create({
    product: productId,
    unit_amount: priceAmount,
    currency: 'eur',
    recurring: {
      interval,
    },
    metadata: { ...PLATFORM_METADATA, ...metadata },
  });
}

// Deactivate a price (cannot delete, only archive)
export async function deactivatePrice(priceId: string): Promise<Stripe.Price> {
  return stripe.prices.update(priceId, { active: false });
}

// Get product by ID
export async function getStripeProduct(productId: string): Promise<Stripe.Product> {
  return stripe.products.retrieve(productId);
}

// Get price by ID
export async function getStripePrice(priceId: string): Promise<Stripe.Price> {
  return stripe.prices.retrieve(priceId, {
    expand: ['product'],
  });
}

// ========================================
// SUBSCRIPTION ITEM HELPERS (add-on)
// ========================================

// Add an add-on line item to an existing subscription (prorated)
export async function createSubscriptionItem({
  subscriptionId,
  priceId,
  quantity,
  metadata,
}: {
  subscriptionId: string;
  priceId: string;
  quantity: number;
  metadata?: Record<string, string>;
}): Promise<Stripe.SubscriptionItem> {
  return stripe.subscriptionItems.create({
    subscription: subscriptionId,
    price: priceId,
    quantity,
    proration_behavior: 'create_prorations',
    metadata: { ...PLATFORM_METADATA, ...metadata },
  });
}

// Change the quantity of an add-on line item (prorated)
export async function updateSubscriptionItemQuantity({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}): Promise<Stripe.SubscriptionItem> {
  return stripe.subscriptionItems.update(itemId, {
    quantity,
    proration_behavior: 'create_prorations',
  });
}

// Remove an add-on line item (prorated credit). Stripe non accetta quantity 0:
// la rimozione completa passa da qui.
export async function deleteSubscriptionItem(
  itemId: string
): Promise<Stripe.DeletedSubscriptionItem> {
  return stripe.subscriptionItems.del(itemId, {
    proration_behavior: 'create_prorations',
  });
}
