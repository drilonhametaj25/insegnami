import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { isSaaSMode } from '@/lib/config';
import { generateVerificationToken } from '@/lib/auth-utils';
import { escapeHtml } from '@/lib/api-middleware';
import { getOrCreateCustomer, stripe } from '@/lib/stripe';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Check if registration is allowed (only in SaaS mode)
    if (!isSaaSMode) {
      return NextResponse.json(
        { error: 'Registrazione non disponibile in modalità self-hosted' },
        { status: 403 }
      );
    }

    // Rate limit: 5 registrations per IP per hour. Throttles automated signup
    // abuse without affecting genuine users (most retry within minutes).
    const rl = await rateLimit(request, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 5,
      keyPrefix: 'rl:register',
    });
    if (!rl.success) return rl.error!;

    const body = await request.json();
    const { firstName, lastName, email, password, schoolName, role, planId } = body;

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

    // Validate password complexity (same as change-password)
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return NextResponse.json(
        { error: 'La password deve contenere almeno una lettera minuscola, una maiuscola e un numero' },
        { status: 400 }
      );
    }

    // Check if user already exists
    // BUG-049 fix: Generic error message to prevent user enumeration
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Allow re-registration if email was never verified (incomplete registration)
      if (!existingUser.emailVerified && existingUser.status === 'INACTIVE') {
        // Clean up previous incomplete registration
        await prisma.verificationToken.deleteMany({ where: { identifier: email } });
        const oldUserTenants = await prisma.userTenant.findMany({ where: { userId: existingUser.id } });
        await prisma.userTenant.deleteMany({ where: { userId: existingUser.id } });
        await prisma.user.delete({ where: { id: existingUser.id } });

        // Delete orphan tenants (tenants with no remaining users)
        for (const ut of oldUserTenants) {
          const remainingUsers = await prisma.userTenant.count({ where: { tenantId: ut.tenantId } });
          if (remainingUsers === 0) {
            await prisma.tenant.delete({ where: { id: ut.tenantId } });
          }
        }
        // Fall through to normal registration
      } else {
        return NextResponse.json(
          { error: 'Impossibile completare la registrazione. Verifica i dati e riprova.' },
          { status: 400 }
        );
      }
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
        trialUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 giorni trial
      },
    });

    // Create Stripe customer for the tenant
    let stripeCustomerId: string | null = null;
    try {
      const stripeCustomer = await getOrCreateCustomer({
        email,
        name: `${firstName} ${lastName}`,
        tenantId: tenant.id,
      });
      stripeCustomerId = stripeCustomer.id;

      // Update tenant with Stripe customer ID
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId },
      });
    } catch (stripeError) {
      console.error('Failed to create Stripe customer:', stripeError);
      // Continue without Stripe customer - can be created later
    }

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
        role: role === 'director' ? 'DIRECTOR' : role === 'secretary' ? 'SECRETARY' : 'ADMIN',
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
    // Include planId in verification URL if provided
    const planParam = planId ? `&plan=${encodeURIComponent(planId)}` : '';
    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}${planParam}`;

    // BUG-032 fix: Escape HTML in user-provided data to prevent XSS
    const safeFirstName = escapeHtml(firstName);
    const safeEmail = escapeHtml(email);
    const safeSchoolName = escapeHtml(schoolName);
    const roleLabel = role === 'director' ? 'Dirigente Scolastico' : role === 'secretary' ? 'Segreteria' : 'Amministratore';

    const emailResult = await sendEmail({
      to: email,
      subject: 'Conferma la tua email - InsegnaMi.pro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0ea5e9;">Benvenuto su InsegnaMi.pro!</h1>
          <p>Ciao ${safeFirstName},</p>
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
            <li>Email: ${safeEmail}</li>
            <li>Scuola: ${safeSchoolName}</li>
            <li>Ruolo: ${roleLabel}</li>
          </ul>
          <p>Il link è valido per 24 ore. Se non confermi entro questo periodo, dovrai registrarti nuovamente.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Questo messaggio è stato inviato automaticamente. Se non hai richiesto questa registrazione, ignora questa email.
          </p>
        </div>
      `,
    });

    // Se l'email non parte, rollback e ritorna errore
    if (!emailResult.success) {
      console.error('Failed to send verification email, rolling back registration');
      // Rollback: elimina tutto quello creato
      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      await prisma.userTenant.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });

      // Compensating cleanup: delete the orphan Stripe customer if it was created.
      // Without this, every failed registration leaves a billable customer in Stripe.
      if (stripeCustomerId) {
        try {
          await stripe.customers.del(stripeCustomerId);
        } catch (cleanupError) {
          console.error('Failed to delete orphan Stripe customer:', stripeCustomerId, cleanupError);
        }
      }

      return NextResponse.json(
        { error: 'Impossibile inviare email di verifica. Controlla l\'indirizzo email e riprova.' },
        { status: 500 }
      );
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
