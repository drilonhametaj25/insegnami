import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { z } from 'zod';
import { getTeacherIdForUser, getStudentIdForUser, type AuthContext } from '@/lib/api-auth';

// C6 — Ricevuta di pagamento: notifica in-app + email (sendEmail: true) allo
// user dello studente e, se collegato, al parentUser. Best-effort: qualsiasi
// errore viene loggato e NON deve mai far fallire la richiesta chiamante.
// NB: duplicata in app/api/payments/[id]/route.ts — i file route Next.js non
// possono esportare helper condivisi senza rompere la validazione delle route.
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

const paymentSchema = z.object({
  studentId: z.string().min(1, 'Student ID required'),
  classId: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  paymentMethod: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).default('PENDING'),
  dueDate: z.string().datetime(),
  paidDate: z.string().datetime().optional(),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  reference: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const studentId = searchParams.get('studentId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    // Role-based filtering
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
      // SECURITY: Use parentUserId instead of parentEmail to prevent email substring attacks
      where.student = {
        parentUserId: session.user.id,
      };
    } else if (session.user.role === 'TEACHER') {
      // Teachers can only see payments for their classes
      const tid = await getTeacherIdForUser(ctx);
      where.class = {
        teacherId: tid ?? '__no_teacher__',
      };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
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
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Calculate summary stats for admins
    let summary = null;
    if (isAdminRole(session.user.role)) {
      const stats = await prisma.payment.groupBy({
        by: ['status'],
        where: { tenantId: session.user.tenantId },
        _sum: { amount: true },
        _count: true,
      });

      summary = {
        total: stats.reduce((acc, stat) => acc + (stat._sum.amount?.toNumber() || 0), 0),
        pending: stats.find(s => s.status === 'PENDING')?._sum.amount?.toNumber() || 0,
        paid: stats.find(s => s.status === 'PAID')?._sum.amount?.toNumber() || 0,
        overdue: stats.find(s => s.status === 'OVERDUE')?._sum.amount?.toNumber() || 0,
        counts: {
          total: stats.reduce((acc, stat) => acc + stat._count, 0),
          pending: stats.find(s => s.status === 'PENDING')?._count || 0,
          paid: stats.find(s => s.status === 'PAID')?._count || 0,
          overdue: stats.find(s => s.status === 'OVERDUE')?._count || 0,
        },
      };
    }

    return NextResponse.json({
      payments,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can create payments
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = paymentSchema.parse(body);

    // Verify student belongs to tenant
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        tenantId: session.user.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Studente non trovato' }, { status: 404 });
    }

    // If classId is provided, verify it belongs to tenant and student is enrolled
    if (validatedData.classId) {
      const studentClass = await prisma.studentClass.findFirst({
        where: {
          studentId: validatedData.studentId,
          classId: validatedData.classId,
          class: {
            tenantId: session.user.tenantId,
          },
        },
      });

      if (!studentClass) {
        return NextResponse.json(
          { error: 'Lo studente non è iscritto a questa classe' },
          { status: 400 }
        );
      }
    }

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId: session.user.tenantId,
          studentId: validatedData.studentId,
          // classId vuoto (form senza classe) → null per non violare la FK
          classId: validatedData.classId || null,
          amount: validatedData.amount,
          paymentMethod: validatedData.paymentMethod,
          status: validatedData.status,
          dueDate: new Date(validatedData.dueDate),
          paidDate: validatedData.paidDate ? new Date(validatedData.paidDate) : null,
          description: validatedData.description,
          notes: validatedData.notes,
          reference: validatedData.reference,
        },
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

      // If the payment is created already PAID (e.g. cassa registers a
      // walk-in), record the revenue movement immediately. Otherwise the
      // movement will be created later when an admin marks it PAID via PUT.
      if (validatedData.status === 'PAID') {
        const { syncPaymentMovement } = await import('@/lib/accounting/movements');
        await syncPaymentMovement(tx, created.id);
      }

      return created;
    });

    // C6 — Pagamento nato già PAID (es. incasso in cassa): ricevuta immediata
    // DOPO il commit. Best-effort: non fa mai fallire la POST.
    if (validatedData.status === 'PAID') {
      await sendPaymentReceipt({
        id: payment.id,
        tenantId: payment.tenantId,
        studentId: payment.studentId,
        amount: payment.amount,
        description: payment.description,
        paidDate: payment.paidDate,
      });
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
