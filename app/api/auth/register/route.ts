import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { isSaaSMode } from '@/lib/config';
import { generateVerificationToken } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    // Check if registration is allowed (only in SaaS mode)
    if (!isSaaSMode) {
      return NextResponse.json(
        { error: 'Registrazione non disponibile in modalità self-hosted' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, password, schoolName, role } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !schoolName) {
      return NextResponse.json(
        { error: 'Tutti i campi sono obbligatori' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato email non valido' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La password deve essere di almeno 8 caratteri' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utente con questa email è già registrato' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Create tenant (school) first
    const tenant = await prisma.tenant.create({
      data: {
        name: schoolName,
        slug: schoolName.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        isActive: false, // Will be activated after email verification
      },
    });

    // Create user with admin role for the new tenant
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        status: 'INACTIVE', // Will be activated after email verification
        emailVerified: null,
        verificationToken,
      },
    });

    // Create user-tenant relationship
    await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: role === 'director' ? 'ADMIN' : role === 'secretary' ? 'ADMIN' : 'ADMIN',
        permissions: {},
      },
    });

    // Store verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    try {
      const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
      await sendEmail({
        to: email,
        subject: 'Conferma la tua email - InsegnaMi.pro',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0ea5e9;">Benvenuto su InsegnaMi.pro!</h1>
            <p>Ciao ${firstName},</p>
            <p>Grazie per esserti registrato su InsegnaMi.pro. Per completare la registrazione, clicca sul link sottostante per confermare la tua email:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Conferma Email
              </a>
            </div>
            <p>Oppure copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p><strong>Dettagli del tuo account:</strong></p>
            <ul>
              <li>Email: ${email}</li>
              <li>Scuola: ${schoolName}</li>
              <li>Ruolo: ${role === 'director' ? 'Dirigente Scolastico' : role === 'secretary' ? 'Segreteria' : 'Amministratore'}</li>
            </ul>
            <p>Il link è valido per 24 ore. Se non confermi entro questo periodo, dovrai registrarti nuovamente.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Questo messaggio è stato inviato automaticamente. Se non hai richiesto questa registrazione, ignora questa email.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the registration if email fails, but log it
    }

    return NextResponse.json({
      message: 'Registrazione completata. Controlla la tua email per confermare l\'account.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
        },
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
