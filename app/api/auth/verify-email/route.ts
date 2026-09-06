import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSubscriptionCheckoutSession } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  // Behind the reverse proxy request.url is the internal listen address
  // (e.g. http://0.0.0.0:3000), so redirects must use the public base URL.
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const planId = searchParams.get('plan'); // Plan selected during registration
    // Intervallo di fatturazione scelto al pricing (propagato dal register)
    const interval = searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly';
    // Locale dell'utente (fallback it): pilota le pagine di ritorno checkout
    const localeParam = searchParams.get('locale');
    const locale = localeParam && ['it', 'en', 'fr', 'pt'].includes(localeParam) ? localeParam : 'it';

    if (!token || !email) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid-verification', baseUrl));
    }

    // Find user by email and token
    const user = await prisma.user.findFirst({
      where: {
        email: decodeURIComponent(email),
        verificationToken: token,
      },
    });

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid-verification', baseUrl));
    }

    // Check if verification token is still valid (24 hours)
    const verificationTokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: decodeURIComponent(email),
        token,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!verificationTokenRecord) {
      return NextResponse.redirect(new URL('/auth/login?error=expired-verification', baseUrl));
    }

    // Update user status and email verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    // Activate tenant if this is the first user (admin/director/secretary)
    const userTenant = await prisma.userTenant.findFirst({
      where: {
        userId: user.id,
        role: { in: ['ADMIN', 'DIRECTOR', 'SECRETARY'] },
      },
      include: {
        tenant: true,
      },
    });

    if (userTenant) {
      // SECURITY: Trial countdown starts at registration (set in register route),
      // NOT at verification. Resetting trialUntil here would let users delay
      // verification to extend their trial beyond the intended 14 days.
      // Only activate the tenant — leave trialUntil untouched.
      await prisma.tenant.update({
        where: { id: userTenant.tenantId },
        data: {
          isActive: true,
        },
      });
    }

    // Remove the verification token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: decodeURIComponent(email),
          token,
        },
      },
    });

    // If a plan was selected during registration, redirect to Stripe checkout
    if (planId && userTenant?.tenant.stripeCustomerId) {
      try {
        // Find the plan
        const plan = await prisma.plan.findFirst({
          where: {
            OR: [
              { id: planId },
              { slug: planId },
            ],
            isActive: true,
          },
        });

        if (plan && plan.stripePriceId) {
          // Annuale: prezzo dedicato (12 mesi al prezzo di 10). Se la sync non
          // ha ancora creato il prezzo annuale si procede col mensile.
          const priceId =
            interval === 'yearly' && plan.stripeYearlyPriceId
              ? plan.stripeYearlyPriceId
              : plan.stripePriceId;

          // Guard anti-abuso trial: giorni residui da tenant.trialUntil
          // (fissato alla registrazione), NON un valore fisso — stesso pattern
          // di app/api/subscriptions/checkout.
          const trialUntil = userTenant.tenant.trialUntil;
          const trialDays = trialUntil
            ? Math.max(0, Math.ceil((new Date(trialUntil).getTime() - Date.now()) / 86400000))
            : 0;

          // Create Stripe checkout session with residual trial
          const checkoutSession = await createSubscriptionCheckoutSession({
            customerId: userTenant.tenant.stripeCustomerId,
            priceId,
            tenantId: userTenant.tenantId,
            trialDays,
            successUrl: `${baseUrl}/${locale}/checkout/success`,
            cancelUrl: `${baseUrl}/${locale}/checkout/cancel`,
          });

          if (checkoutSession.url) {
            return NextResponse.redirect(checkoutSession.url);
          }
        }
      } catch (stripeError) {
        console.error('Failed to create Stripe checkout session:', stripeError);
        // Fall through to normal login redirect
      }
    }

    // Redirect to login with success message (no plan or Stripe error)
    return NextResponse.redirect(new URL('/auth/login?verified=true', baseUrl));

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/auth/login?error=verification-failed', baseUrl));
  }
}
