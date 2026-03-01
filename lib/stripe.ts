import Stripe from 'stripe';

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
  get billingPortal() {
    return getStripeClient().billingPortal;
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
      paymentId,
      ...metadata,
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
      trial_period_days: trialDays,
      metadata: {
        tenantId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
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
}: {
  subscriptionId: string;
  newPriceId: string;
}): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;

  if (!itemId) {
    throw new Error('No subscription item found');
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: itemId,
        price: newPriceId,
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
    metadata,
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
    metadata,
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
