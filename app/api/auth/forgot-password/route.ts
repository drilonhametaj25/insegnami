import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { generatePasswordResetToken } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email) {
      return NextResponse.json(
        { error: 'Email richiesta' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato email non valido' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // For security, always return success even if user doesn't exist
    if (!user) {
      return NextResponse.json({
        message: 'Se l\'email è registrata, riceverai le istruzioni per reimpostare la password.',
      });
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send reset email
    try {
      const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      
      await sendEmail({
        to: email,
        subject: 'Reimpostazione Password - InsegnaMi.pro',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0ea5e9;">Reimpostazione Password</h1>
            <p>Ciao ${user.firstName},</p>
            <p>Hai richiesto la reimpostazione della tua password. Clicca sul link sottostante per impostare una nuova password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reimposta Password
              </a>
            </div>
            <p>Oppure copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p><strong>Importante:</strong></p>
            <ul>
              <li>Il link è valido per 1 ora</li>
              <li>Puoi utilizzare questo link solo una volta</li>
              <li>Se non hai richiesto questa reimpostazione, ignora questa email</li>
            </ul>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Questo messaggio è stato inviato automaticamente da InsegnaMi.pro. Se hai problemi, contatta il supporto.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return NextResponse.json(
        { error: 'Errore nell\'invio dell\'email. Riprova più tardi.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Se l\'email è registrata, riceverai le istruzioni per reimpostare la password.',
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
