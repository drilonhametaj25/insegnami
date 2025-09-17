import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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

    const { id } = await params;

    const where: any = {
      id: id,
      tenantId: session.user.tenantId,
    };

    // Role-based filtering
    if (session.user.role === 'STUDENT') {
      where.student = {
        email: session.user.email,
      };
    } else if (session.user.role === 'PARENT') {
      where.student = {
        parentEmail: session.user.email,
      };
    } else if (session.user.role === 'TEACHER') {
      where.class = {
        teacherId: session.user.id,
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

    // Only admins can update payments
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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

    const updatedPayment = await prisma.payment.update({
      where: { id: id },
      data: updateData,
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
    });

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

    // Only admins can delete payments
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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

    await prisma.payment.delete({
      where: { id: id },
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
