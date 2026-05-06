import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSubscriptionCheckoutSession } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const planId = searchParams.get('plan'); // Plan selected during registration

    if (!token || !email) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid-verification', request.url));
    }

    // Find user by email and token
    const user = await prisma.user.findFirst({
      where: {
        email: decodeURIComponent(email),
        verificationToken: token,
      },
    });

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid-verification', request.url));
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
      return NextResponse.redirect(new URL('/auth/login?error=expired-verification', request.url));
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
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

          // Create Stripe checkout session with trial
          const checkoutSession = await createSubscriptionCheckoutSession({
            customerId: userTenant.tenant.stripeCustomerId,
            priceId: plan.stripePriceId,
            tenantId: userTenant.tenantId,
            trialDays: 14,
            successUrl: `${baseUrl}/it/dashboard?subscription=success`,
            cancelUrl: `${baseUrl}/it/pricing?cancelled=true`,
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
    return NextResponse.redirect(new URL('/auth/login?verified=true', request.url));

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/auth/login?error=verification-failed', request.url));
  }
}
