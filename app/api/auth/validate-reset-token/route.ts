import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = body;

    // Validate input
    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token ed email richiesti', valid: false },
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
      return NextResponse.json({
        error: 'Token non valido o scaduto',
        valid: false,
      });
    }

    return NextResponse.json({
      valid: true,
      message: 'Token valido',
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server', valid: false },
      { status: 500 }
    );
  }
}
