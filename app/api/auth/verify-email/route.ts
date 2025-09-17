import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

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

    // Activate tenant if this is the first user
    const userTenant = await prisma.userTenant.findFirst({
      where: {
        userId: user.id,
        role: 'ADMIN',
      },
      include: {
        tenant: true,
      },
    });

    if (userTenant && !userTenant.tenant.isActive) {
      await prisma.tenant.update({
        where: { id: userTenant.tenantId },
        data: { isActive: true },
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

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/auth/login?verified=true', request.url));

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/auth/login?error=verification-failed', request.url));
  }
}
