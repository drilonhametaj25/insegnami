import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { constructWebhookEvent, retrieveSubscription } from '@/lib/stripe';
import Stripe from 'stripe';
import { SubscriptionStatus } from '@prisma/client';

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
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
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
          const priceId = stripeSubscription.items.data[0]?.price?.id;

          if (!priceId) {
            console.error('No price found in subscription');
            break;
          }

          // Find the plan by Stripe price ID
          const plan = await prisma.plan.findUnique({
            where: { stripePriceId: priceId },
          });

          if (!plan) {
            console.error(`Plan not found for price ID: ${priceId}`);
            break;
          }

          // Create or update subscription in our database
          await prisma.subscription.upsert({
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
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              plan: plan.slug.toUpperCase(),
              stripeCustomerId: session.customer as string,
            },
          });

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
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment failed: ${paymentIntent.id}`);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Refund processed: ${charge.id}`);
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

        const priceId = subscription.items.data[0]?.price?.id;
        if (!priceId) {
          console.error('No price found in subscription');
          break;
        }

        const plan = await prisma.plan.findUnique({
          where: { stripePriceId: priceId },
        });

        if (!plan) {
          console.error(`Plan not found for price ID: ${priceId}`);
          break;
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

        console.log(`Subscription created: ${subscription.id} for tenant ${tenantId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;

        // Find subscription by Stripe ID
        const existingSubscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!existingSubscription) {
          console.log(`Subscription not found: ${subscription.id}`);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
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
          console.log(`Subscription not found for deletion: ${subscription.id}`);
          break;
        }

        // Mark subscription as cancelled
        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });

        // Update tenant to free plan
        await prisma.tenant.update({
          where: { id: existingSubscription.tenantId },
          data: { plan: 'FREE' },
        });

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

        console.log(`Invoice payment failed for subscription: ${subscriptionId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
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
