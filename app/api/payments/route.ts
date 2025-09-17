import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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
    if (session.user.role === 'STUDENT') {
      where.student = {
        email: session.user.email,
      };
    } else if (session.user.role === 'PARENT') {
      where.student = {
        parentEmail: session.user.email,
      };
    } else if (session.user.role === 'TEACHER') {
      // Teachers can only see payments for their classes
      where.class = {
        teacherId: session.user.id,
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
    if (['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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

    // Only admins can create payments
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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

    const payment = await prisma.payment.create({
      data: {
        tenantId: session.user.tenantId,
        studentId: validatedData.studentId,
        classId: validatedData.classId,
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
