import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { generateVerificationToken } from '@/lib/auth-utils';
import { escapeHtml } from '@/lib/api-middleware';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email richiesta' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Risposta generica per sicurezza (non rivelare se email esiste)
    if (!user || user.emailVerified) {
      return NextResponse.json({
        message: 'Se l\'email esiste e non e\' verificata, riceverai un link di verifica',
      });
    }

    // Rate limiting: controlla ultimo token creato
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: new Date() },
      },
      orderBy: { expires: 'desc' },
    });

    // Se token creato meno di 60 secondi fa, blocca
    if (recentToken) {
      const tokenAge = Date.now() - (recentToken.expires.getTime() - 24 * 60 * 60 * 1000);
      if (tokenAge < 60000) {
        return NextResponse.json(
          { error: 'Attendi 60 secondi prima di richiedere un\'altra email' },
          { status: 429 }
        );
      }
    }

    // Elimina vecchi token
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Genera nuovo token
    const verificationToken = generateVerificationToken();

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Aggiorna token su user
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    // Invia email
    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    const safeFirstName = escapeHtml(user.firstName || 'Utente');

    const emailResult = await sendEmail({
      to: email,
      subject: 'Conferma la tua email - InsegnaMi.pro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0ea5e9;">Verifica la tua email</h1>
          <p>Ciao ${safeFirstName},</p>
          <p>Clicca sul link sottostante per verificare la tua email:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verifica Email
            </a>
          </div>
          <p>Oppure copia e incolla questo link nel tuo browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p>Il link e' valido per 24 ore.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Questo messaggio e' stato inviato automaticamente. Se non hai richiesto questa verifica, ignora questa email.
          </p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Errore nell\'invio dell\'email. Riprova tra qualche minuto.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Email di verifica inviata',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'invio dell\'email' },
      { status: 500 }
    );
  }
}
