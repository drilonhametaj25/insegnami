import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { constructWebhookEvent, retrieveSubscription, PLATFORM_METADATA } from '@/lib/stripe';
import Stripe from 'stripe';
import { SubscriptionStatus } from '@prisma/client';
import { redis } from '@/lib/redis';
import { sanitizeError } from '@/lib/api-middleware';
import { reconcileAddonItems } from '@/lib/billing/stripe-addons';
import { invalidateTenantAccessCache } from '@/lib/tenant-access';

// Check if event has already been processed (deduplication)
async function isEventProcessed(eventId: string): Promise<boolean> {
  const key = `stripe:event:${eventId}`;
  const exists = await redis.get(key);
  return exists !== null;
}

// Mark event as processed with 24h expiry
async function markEventProcessed(eventId: string): Promise<void> {
  const key = `stripe:event:${eventId}`;
  await redis.set(key, 'processed', 86400); // 24 hours TTL
}

// Lo stesso account Stripe serve più applicativi: l'endpoint riceve TUTTI gli
// eventi dell'account, quindi ogni evento va attribuito prima di processarlo.
// Le entità create da InsegnaMi portano metadata.platform = 'InsegnaMi'
// (PLATFORM_METADATA); per gli eventi senza metadata propri (invoice.*, o
// entità create prima dell'introduzione del metadata) si risale al tenant via
// stripeCustomerId / stripeSubscriptionId / paymentId in DB.
async function classifyEvent(event: Stripe.Event): Promise<'ours' | 'foreign'> {
  const obj = event.data.object as any;
  const platform = obj?.metadata?.platform;
  if (platform === PLATFORM_METADATA.platform) return 'ours';
  if (platform) return 'foreign'; // metadata di un altro applicativo

  const customerId = typeof obj?.customer === 'string' ? obj.customer : obj?.customer?.id;

  if (event.type.startsWith('checkout.session.')) {
    const tenantId = obj?.metadata?.tenantId;
    if (tenantId && (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) {
      return 'ours';
    }
    const paymentId = obj?.metadata?.paymentId;
    if (paymentId && (await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true } }))) {
      return 'ours';
    }
    return 'foreign';
  }

  if (event.type.startsWith('customer.subscription.')) {
    if (
      obj?.id &&
      (await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: obj.id },
        select: { id: true },
      }))
    ) {
      return 'ours';
    }
    if (
      customerId &&
      (await prisma.tenant.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } }))
    ) {
      return 'ours';
    }
    const tenantId = obj?.metadata?.tenantId;
    if (tenantId && (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) {
      return 'ours';
    }
    return 'foreign';
  }

  if (event.type.startsWith('invoice.')) {
    const subId = typeof obj?.subscription === 'string' ? obj.subscription : obj?.subscription?.id;
    if (
      subId &&
      (await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
        select: { id: true },
      }))
    ) {
      return 'ours';
    }
    if (
      customerId &&
      (await prisma.tenant.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } }))
    ) {
      return 'ours';
    }
    return 'foreign';
  }

  if (event.type.startsWith('payment_intent.') || event.type.startsWith('charge.')) {
    const paymentId = obj?.metadata?.paymentId;
    if (paymentId && (await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true } }))) {
      return 'ours';
    }
    return 'foreign';
  }

  // Famiglie di eventi che non gestiamo e senza platform metadata: non nostre.
  return 'foreign';
}

// L'abbonamento può contenere item add-on oltre all'item del piano:
// l'item piano è quello il cui prezzo NON ha metadata.addonType.
// items.data[0] non è più affidabile da quando esistono gli add-on.
function findPlanPriceId(items: Array<{ price?: { id?: string; metadata?: Record<string, string> } }>): string | undefined {
  const planItem = items.find((it) => !it.price?.metadata?.addonType) ?? items[0];
  return planItem?.price?.id;
}

// Map Stripe subscription status to our SubscriptionStatus enum
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELLED';
    case 'unpaid':
      return 'UNPAID';
    case 'paused':
      return 'PAUSED';
    default:
      return 'ACTIVE';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      // BUG-048 fix: Sanitize error to prevent secrets in logs
      console.error('Webhook signature verification failed:', sanitizeError(err));
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Event deduplication: Check if this event has already been processed
    if (await isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, deduplicated: true });
    }

    // Lo stesso account Stripe serve più applicativi: gli eventi che non
    // appartengono a InsegnaMi vengono ack-ati senza processing.
    if ((await classifyEvent(event)) === 'foreign') {
      console.log(`Event ${event.id} (${event.type}) ignored: foreign platform`);
      await markEventProcessed(event.id);
      return NextResponse.json({ received: true, ignored: 'foreign-platform' });
    }

    // Handle the event
    switch (event.type) {
      // ========================================
      // ONE-TIME PAYMENT EVENTS
      // ========================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Check if this is a subscription checkout or one-time payment
        if (session.mode === 'subscription') {
          // Handle subscription checkout completion
          const tenantId = session.metadata?.tenantId;
          const subscriptionId = session.subscription as string;

          if (!tenantId || !subscriptionId) {
            console.error('Missing tenantId or subscriptionId in subscription checkout');
            break;
          }

          // Retrieve full subscription details
          const stripeSubscription = await retrieveSubscription(subscriptionId) as any;
          const priceId = findPlanPriceId(stripeSubscription.items.data);

          if (!priceId) {
            console.error('No price found in subscription');
            break;
          }

          // Find the plan by Stripe price ID
          const plan = await prisma.plan.findUnique({
            where: { stripePriceId: priceId },
          });

          if (!plan) {
            // BUG-024 fix: Throw error instead of silent break - plan sync required
            throw new Error(`Plan not found for Stripe price ID: ${priceId}. Database sync required.`);
          }

          // Create or update subscription in our database (atomic transaction)
          await prisma.$transaction(async (tx) => {
            await tx.subscription.upsert({
              where: { tenantId },
              create: {
                tenantId,
                planId: plan.id,
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: session.customer as string,
                status: mapStripeStatus(stripeSubscription.status),
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                trialStart: stripeSubscription.trial_start
                  ? new Date(stripeSubscription.trial_start * 1000)
                  : null,
                trialEnd: stripeSubscription.trial_end
                  ? new Date(stripeSubscription.trial_end * 1000)
                  : null,
              },
              update: {
                planId: plan.id,
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: session.customer as string,
                status: mapStripeStatus(stripeSubscription.status),
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                trialStart: stripeSubscription.trial_start
                  ? new Date(stripeSubscription.trial_start * 1000)
                  : null,
                trialEnd: stripeSubscription.trial_end
                  ? new Date(stripeSubscription.trial_end * 1000)
                  : null,
              },
            });

            // Update tenant with plan info
            await tx.tenant.update({
              where: { id: tenantId },
              data: {
                plan: plan.slug.toUpperCase(),
                stripeCustomerId: session.customer as string,
              },
            });
          });

          await invalidateTenantAccessCache(tenantId);
          console.log(`Subscription created for tenant ${tenantId}, plan: ${plan.name}`);
        } else {
          // Handle one-time payment checkout
          const paymentId = session.metadata?.paymentId;

          if (!paymentId) {
            console.log('No paymentId in session metadata (may be subscription checkout)');
            break;
          }

          // Update payment status
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: 'PAID',
              paidDate: new Date(),
              paymentMethod: 'CREDIT_CARD',
              notes: `Pagato via Stripe. Payment Intent: ${session.payment_intent}`,
            },
          });

          console.log(`Payment ${paymentId} marked as PAID via Stripe`);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId;

        if (paymentId) {
          console.log(`Checkout session expired for payment ${paymentId}`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        // BUG-023 fix: Update payment status in DB
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const failedPaymentId = paymentIntent.metadata?.paymentId;

        if (failedPaymentId) {
          await prisma.payment.update({
            where: { id: failedPaymentId },
            data: {
              status: 'OVERDUE',
              notes: `Pagamento fallito: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
            },
          });
          console.log(`Payment ${failedPaymentId} marked as OVERDUE due to payment failure`);
        } else {
          console.log(`Payment failed (no paymentId in metadata): ${paymentIntent.id}`);
        }
        break;
      }

      case 'charge.refunded': {
        // BUG-023 fix: Update payment status for refund
        const charge = event.data.object as Stripe.Charge;
        const refundedPaymentId = charge.metadata?.paymentId;

        if (refundedPaymentId) {
          await prisma.payment.update({
            where: { id: refundedPaymentId },
            data: {
              status: 'CANCELLED',
              notes: `Rimborso elaborato. Charge ID: ${charge.id}`,
            },
          });
          console.log(`Payment ${refundedPaymentId} marked as CANCELLED due to refund`);
        } else {
          console.log(`Refund processed (no paymentId in metadata): ${charge.id}`);
        }
        break;
      }

      // ========================================
      // SUBSCRIPTION EVENTS
      // ========================================
      case 'customer.subscription.created': {
        const subscription = event.data.object as any;
        const tenantId = subscription.metadata?.tenantId;

        if (!tenantId) {
          console.log('No tenantId in subscription metadata');
          break;
        }

        const priceId = findPlanPriceId(subscription.items.data);
        if (!priceId) {
          console.error('No price found in subscription');
          break;
        }

        const plan = await prisma.plan.findUnique({
          where: { stripePriceId: priceId },
        });

        if (!plan) {
          // BUG-024 fix: Throw error instead of silent break - plan sync required
          throw new Error(`Plan not found for Stripe price ID: ${priceId}. Database sync required.`);
        }

        // Create subscription record
        await prisma.subscription.upsert({
          where: { tenantId },
          create: {
            tenantId,
            planId: plan.id,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            trialStart: subscription.trial_start
              ? new Date(subscription.trial_start * 1000)
              : null,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
          update: {
            planId: plan.id,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });

        // Allinea gli eventuali item add-on presenti già alla creazione
        await reconcileAddonItems({
          tenantId,
          stripeSubscriptionId: subscription.id,
          items: subscription.items.data,
        });

        await invalidateTenantAccessCache(tenantId);
        console.log(`Subscription created: ${subscription.id} for tenant ${tenantId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;

        // Find subscription by Stripe ID
        let existingSubscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!existingSubscription) {
          // Backfill: l'evento updated può arrivare prima/al posto di created
          // (race) o riferirsi a una subscription creata fuori dall'app.
          // Risali al tenant via metadata o stripeCustomerId e crea la riga.
          const tenantId =
            subscription.metadata?.tenantId ??
            (
              await prisma.tenant.findUnique({
                where: { stripeCustomerId: subscription.customer as string },
                select: { id: true },
              })
            )?.id;

          const backfillPriceId = findPlanPriceId(subscription.items.data);
          const backfillPlan = backfillPriceId
            ? await prisma.plan.findUnique({ where: { stripePriceId: backfillPriceId } })
            : null;

          if (tenantId && backfillPlan) {
            existingSubscription = await prisma.subscription.upsert({
              where: { tenantId },
              create: {
                tenantId,
                planId: backfillPlan.id,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                status: mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                trialStart: subscription.trial_start
                  ? new Date(subscription.trial_start * 1000)
                  : null,
                trialEnd: subscription.trial_end
                  ? new Date(subscription.trial_end * 1000)
                  : null,
              },
              update: {
                planId: backfillPlan.id,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                status: mapStripeStatus(subscription.status),
              },
            });
            console.log(`Backfilled subscription ${subscription.id} for tenant ${tenantId}`);
          } else {
            // Non riconducibile a un tenant: ack (200) per fermare i retry Stripe
            console.warn(`Subscription not found and not backfillable, acking: ${subscription.id}`);
            break;
          }
        }

        const priceId = findPlanPriceId(subscription.items.data);
        let planId = existingSubscription.planId;

        // Check if plan changed
        if (priceId) {
          const plan = await prisma.plan.findUnique({
            where: { stripePriceId: priceId },
          });
          if (plan) {
            planId = plan.id;

            // Update tenant plan if changed
            await prisma.tenant.update({
              where: { id: existingSubscription.tenantId },
              data: { plan: plan.slug.toUpperCase() },
            });
          }
        }

        // Update subscription record
        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            planId,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            cancelledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : null,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });

        // Allinea gli add-on (quantità cambiate, item aggiunti/rimossi anche
        // fuori dall'app, es. dashboard Stripe o billing portal)
        await reconcileAddonItems({
          tenantId: existingSubscription.tenantId,
          stripeSubscriptionId: subscription.id,
          items: subscription.items.data,
        });

        await invalidateTenantAccessCache(existingSubscription.tenantId);
        console.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;

        // Find and update subscription
        const existingSubscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!existingSubscription) {
          console.warn(`Subscription not found for deletion, acking: ${subscription.id}`);
          break;
        }

        // Atomic transaction: mark subscription cancelled and update tenant
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          });

          await tx.tenant.update({
            where: { id: existingSubscription.tenantId },
            data: { plan: 'FREE' },
          });

          // Gli add-on muoiono con l'abbonamento (solo quelli legati a Stripe;
          // le righe dev-billing, senza item id, non vengono toccate)
          await tx.tenantAddon.updateMany({
            where: {
              tenantId: existingSubscription.tenantId,
              stripeSubscriptionItemId: { not: null },
            },
            data: { status: 'CANCELLED', quantity: 0 },
          });
        });

        await invalidateTenantAccessCache(existingSubscription.tenantId);
        console.log(`Subscription deleted: ${subscription.id}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          break;
        }

        // Update subscription status to active if it was past_due
        await prisma.subscription.updateMany({
          where: {
            stripeSubscriptionId: subscriptionId,
            status: 'PAST_DUE',
          },
          data: {
            status: 'ACTIVE',
          },
        });

        const paidSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { tenantId: true },
        });
        if (paidSub) await invalidateTenantAccessCache(paidSub.tenantId);

        console.log(`Invoice paid for subscription: ${subscriptionId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          break;
        }

        // Mark subscription as past_due
        await prisma.subscription.updateMany({
          where: {
            stripeSubscriptionId: subscriptionId,
          },
          data: {
            status: 'PAST_DUE',
          },
        });

        const failedSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { tenantId: true },
        });
        if (failedSub) await invalidateTenantAccessCache(failedSub.tenantId);

        console.log(`Invoice payment failed for subscription: ${subscriptionId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed for deduplication
    await markEventProcessed(event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    // BUG-048 fix: Sanitize error to prevent secrets in logs
    console.error('Webhook error:', sanitizeError(error));
    // Gli eventi di altri applicativi vengono già filtrati da classifyEvent:
    // qui arrivano solo errori GENUINI su eventi InsegnaMi. 500 fa ritentare
    // Stripe (con backoff); l'evento non è stato marcato in Redis, quindi il
    // retry verrà riprocessato da capo.
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing - Stripe needs raw body
export const config = {
  api: {
    bodyParser: false,
  },
};
