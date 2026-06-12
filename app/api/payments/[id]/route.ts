import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { z } from 'zod';
import { getTeacherIdForUser, getStudentIdForUser, type AuthContext } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';

// C6 — Ricevuta di pagamento: notifica in-app + email (sendEmail: true) allo
// user dello studente e, se collegato, al parentUser. Best-effort: qualsiasi
// errore viene loggato e NON deve mai far fallire la richiesta chiamante
// (il pagamento è già committato quando questa funzione parte).
async function sendPaymentReceipt(payment: {
  id: string;
  tenantId: string;
  studentId: string;
  amount: unknown;
  description: string;
  paidDate?: Date | null;
}) {
  try {
    const { createAndDispatch } = await import('@/lib/notifications/dispatcher');

    // userId è obbligatorio su Student, parentUserId opzionale
    const student = await prisma.student.findFirst({
      where: { id: payment.studentId },
      select: { userId: true, parentUserId: true },
    });
    if (!student) return;

    // Importo in formato italiano (es. 1.250,00) e data del pagamento
    const importo = Number(payment.amount).toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const dataPagamento = (payment.paidDate ?? new Date()).toLocaleDateString('it-IT');
    const base = {
      tenantId: payment.tenantId,
      title: 'Ricevuta di pagamento',
      content: `Abbiamo registrato il pagamento di € ${importo} — "${payment.description}" — in data ${dataPagamento}. Questa notifica vale come ricevuta.`,
      type: 'PAYMENT' as const,
      sourceType: 'Payment',
      sourceId: payment.id,
    };

    // Ricevuta allo studente
    await createAndDispatch(
      { ...base, userId: student.userId, actionUrl: '/dashboard/student' },
      { sendEmail: true },
    );

    // Ricevuta al genitore, se esiste un account collegato
    if (student.parentUserId) {
      await createAndDispatch(
        { ...base, userId: student.parentUserId, actionUrl: '/dashboard/parent' },
        { sendEmail: true },
      );
    }
  } catch (error) {
    // Fire-and-forget: logghiamo e basta, niente throw verso il chiamante
    console.error('Errore invio ricevuta di pagamento (non bloccante):', error);
  }
}

const paymentUpdateSchema = z.object({
  description: z.string().min(1, 'Descrizione richiesta').optional(),
  amount: z.number().positive('L\'importo deve essere positivo').optional(),
  currency: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidDate: z.string().datetime().optional(),
});

export async function GET(
  request: NextRequest,
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
      id: id,
      tenantId: session.user.tenantId,
    };

    // SECURITY: Class.teacherId references Teacher.id, NOT User.id.
    // PARENT must filter by parentUserId, not parentEmail (substring attack).
    const ctx = {
      userId: session.user.id ?? '',
      tenantId: session.user.tenantId,
      role: session.user.role,
      email: session.user.email ?? '',
      isSuperAdmin: session.user.role === 'SUPERADMIN',
      session,
    } as AuthContext;

    // Role-based filtering
    if (session.user.role === 'STUDENT') {
      const sid = await getStudentIdForUser(ctx);
      where.studentId = sid ?? '__no_student__';
    } else if (session.user.role === 'PARENT') {
      where.student = {
        parentUserId: session.user.id,
      };
    } else if (session.user.role === 'TEACHER') {
      const tid = await getTeacherIdForUser(ctx);
      where.class = {
        teacherId: tid ?? '__no_teacher__',
      };
    }

    const payment = await prisma.payment.findFirst({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            email: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            course: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento non trovato' }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can update payments
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = paymentUpdateSchema.parse(body);
    const { id } = await params;

    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Pagamento non trovato' }, { status: 404 });
    }

    // If marking as paid, set paidDate if not provided
    const updateData: any = { ...validatedData };
    if (validatedData.status === 'PAID' && !validatedData.paidDate && !existingPayment.paidDate) {
      updateData.paidDate = new Date();
    } else if (validatedData.paidDate) {
      updateData.paidDate = new Date(validatedData.paidDate);
    }

    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate);
    }

    // Sync AccountingMovement (REVENUE) atomically with the status flip.
    // Three transitions to handle:
    //   - * → PAID:        create movement (idempotent via syncPaymentMovement)
    //   - PAID → *:        reverse the movement (P&L would otherwise count it forever)
    //   - PAID → PAID:     no-op (sync is idempotent)
    const willBePaid = validatedData.status === 'PAID' && existingPayment.status !== 'PAID';
    const wasPaid = existingPayment.status === 'PAID' && validatedData.status && validatedData.status !== 'PAID';

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: id },
        data: updateData,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, studentCode: true, email: true } },
          class: {
            select: {
              id: true, name: true, code: true,
              course: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (willBePaid) {
        const { syncPaymentMovement } = await import('@/lib/accounting/movements');
        // Tracciabilità: chi ha marcato il pagamento come PAID finisce sul movimento contabile
        await syncPaymentMovement(tx, id, { createdBy: session.user.id });
      } else if (wasPaid) {
        const { reversePaymentMovement } = await import('@/lib/accounting/movements');
        await reversePaymentMovement(tx, id);
      }

      return updated;
    });

    // C6 — Ricevuta email DOPO il commit, solo sulla transizione *→PAID
    // (PAID→PAID non rinvia: willBePaid è false). sendPaymentReceipt non
    // lancia mai, quindi la PUT risponde 200 anche se il dispatcher fallisce.
    if (willBePaid) {
      await sendPaymentReceipt({
        id: updatedPayment.id,
        tenantId: updatedPayment.tenantId,
        studentId: updatedPayment.studentId,
        amount: updatedPayment.amount,
        description: updatedPayment.description,
        paidDate: updatedPayment.paidDate,
      });
    }

    return NextResponse.json(updatedPayment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can delete payments
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Pagamento non trovato' }, { status: 404 });
    }

    // Don't allow deletion of paid payments
    if (existingPayment.status === 'PAID') {
      return NextResponse.json(
        { error: 'Non è possibile eliminare un pagamento già effettuato' },
        { status: 400 }
      );
    }

    // Audit DELETE (C0.4): snapshot minimo nella stessa transazione del delete,
    // così la riga di audit non può divergere dall'operazione tracciata
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        tenantId: existingPayment.tenantId,
        userId: session.user.id ?? '',
        action: 'DELETE',
        entity: 'Payment',
        entityId: id,
        oldData: {
          id: existingPayment.id,
          amount: Number(existingPayment.amount),
          status: existingPayment.status,
          studentId: existingPayment.studentId,
          description: existingPayment.description,
        },
        request,
      });

      await tx.payment.delete({
        where: { id: id },
      });
    });

    return NextResponse.json({ message: 'Pagamento eliminato con successo' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
