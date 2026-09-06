import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { getTeacherIdForUser, getStudentIdForUser, type AuthContext } from '@/lib/api-auth';
import { buildPaymentReceiptPdf } from '@/lib/payments/receipt-pdf';

/**
 * GET /api/payments/[id]/receipt — PDF ricevuta di pagamento.
 *
 * Solo pagamenti PAID. Ownership guardian-aware (stesse regole della GET
 * del pagamento): STUDENT → solo i propri, PARENT → figli (StudentGuardian
 * + fallback legacy parentUserId), TEACHER → pagamenti delle proprie classi,
 * ruoli admin → tutti quelli del tenant.
 *
 * Numerazione semplice REC-<anno>-<progressivo per tenant>, calcolata dal
 * count dei pagamenti PAID con paidDate precedente nello stesso anno: non
 * è una numerazione fiscale (per quella ci sono le fatture).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    const where: any = {
      id,
      tenantId: session.user.tenantId,
    };

    // SECURITY: Class.teacherId references Teacher.id, NOT User.id.
    const ctx = {
      userId: session.user.id ?? '',
      tenantId: session.user.tenantId,
      role: session.user.role,
      email: session.user.email ?? '',
      isSuperAdmin: session.user.role === 'SUPERADMIN',
      session,
    } as AuthContext;

    if (session.user.role === 'STUDENT') {
      const sid = await getStudentIdForUser(ctx);
      where.studentId = sid ?? '__no_student__';
    } else if (session.user.role === 'PARENT') {
      // Guardian-aware: StudentGuardian + fallback legacy parentUserId
      where.student = {
        OR: [
          { parentUserId: session.user.id },
          { guardians: { some: { userId: session.user.id } } },
        ],
      };
    } else if (session.user.role === 'TEACHER') {
      const tid = await getTeacherIdForUser(ctx);
      where.class = { teacherId: tid ?? '__no_teacher__' };
    }

    const payment = await prisma.payment.findFirst({
      where,
      include: {
        student: { select: { firstName: true, lastName: true, studentCode: true } },
        class: { select: { name: true } },
        tenant: {
          select: { name: true, address: true, email: true, phone: true, vatNumber: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento non trovato' }, { status: 404 });
    }
    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: 'La ricevuta è disponibile solo per pagamenti incassati (PAID)' },
        { status: 400 },
      );
    }

    // Numerazione: progressivo per tenant/anno dal count dei PAID precedenti.
    const paidDate = payment.paidDate ?? new Date();
    const year = paidDate.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const previousCount = await prisma.payment.count({
      where: {
        tenantId: payment.tenantId,
        status: 'PAID',
        paidDate: { gte: yearStart, lt: paidDate },
      },
    });
    const receiptNumber = `REC-${year}-${String(previousCount + 1).padStart(4, '0')}`;

    const buffer = buildPaymentReceiptPdf({
      receiptNumber,
      school: {
        name: payment.tenant.name,
        address: payment.tenant.address,
        email: payment.tenant.email,
        phone: payment.tenant.phone,
        vatNumber: payment.tenant.vatNumber,
      },
      student: payment.student,
      payment: {
        description: payment.description,
        amount: payment.amount,
        currency: payment.currency,
        paidDate: payment.paidDate,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        className: payment.class?.name ?? null,
      },
    });

    const filename = `ricevuta-${receiptNumber}.pdf`;
    // Cast necessario: NextResponse(BodyInit) non accetta Buffer in TS strict
    // (stesso pattern di invoices/[id]/pdf).
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating payment receipt:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
