import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { createCheckoutSession } from '@/lib/stripe';
import { z } from 'zod';

const checkoutSchema = z.object({
  paymentId: z.string().min(1, 'ID pagamento richiesto'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const body = await request.json();
    const { paymentId } = checkoutSchema.parse(body);

    // Find the payment
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: session.user.tenantId,
      },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            parentUserId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!payment || !payment.student) {
      return NextResponse.json(
        { error: 'Pagamento non trovato' },
        { status: 404 }
      );
    }

    // Ownership: solo admin, lo studente titolare della rata o il suo genitore
    let isOwner =
      (session.user.role === 'STUDENT' && payment.student.userId === session.user.id) ||
      (session.user.role === 'PARENT' && payment.student.parentUserId === session.user.id);
    // Guardian-aware: anche i tutori collegati via StudentGuardian
    if (!isOwner && session.user.role === 'PARENT') {
      const link = await prisma.studentGuardian.findFirst({
        where: { studentId: payment.student.id, userId: session.user.id },
        select: { id: true },
      });
      isOwner = !!link;
    }
    if (!isAdminRole(session.user.role) && !isOwner) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Don't allow checkout for already paid or cancelled payments
    if (payment.status === 'PAID') {
      return NextResponse.json(
        { error: 'Pagamento già effettuato' },
        { status: 400 }
      );
    }

    if (payment.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Pagamento annullato' },
        { status: 400 }
      );
    }

    // Verify Stripe is configured (dopo i check di autorizzazione)
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe non configurato' },
        { status: 500 }
      );
    }

    const studentName = `${payment.student.firstName} ${payment.student.lastName}`;
    const description = payment.description || `Pagamento per ${payment.class?.name || 'corso'}`;

    // Create Stripe checkout session
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const checkoutSession = await createCheckoutSession({
      paymentId: payment.id,
      studentName,
      amount: Math.round(Number(payment.amount) * 100), // Convert to cents
      description,
      successUrl: `${baseUrl}/it/dashboard/payments?success=true&paymentId=${payment.id}`,
      cancelUrl: `${baseUrl}/it/dashboard/payments?cancelled=true&paymentId=${payment.id}`,
      metadata: {
        tenantId: session.user.tenantId,
        studentId: payment.studentId,
        classId: payment.classId || '',
      },
    });

    // Update payment with Stripe session ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        notes: payment.notes
          ? `${payment.notes}\nStripe Session: ${checkoutSession.id}`
          : `Stripe Session: ${checkoutSession.id}`,
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Errore nella creazione del checkout' },
      { status: 500 }
    );
  }
}
