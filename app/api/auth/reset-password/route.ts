import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email, password } = body;

    // Validate input
    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Token, email e password richiesti' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La password deve contenere almeno 8 caratteri' },
        { status: 400 }
      );
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return NextResponse.json(
        { error: 'La password deve contenere almeno una lettera minuscola, una maiuscola e un numero' },
        { status: 400 }
      );
    }

    // Find user with valid reset token
    const user = await prisma.user.findUnique({
      where: { 
        email,
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Token non valido o scaduto' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        emailVerified: new Date(), // Ensure email is verified when password is reset
        updatedAt: new Date(),
      },
    });

    // Log security event
    console.log(`Password reset successful for user: ${user.email} (ID: ${user.id})`);

    return NextResponse.json({
      message: 'Password reimpostata con successo',
      success: true,
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
