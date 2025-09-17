import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can export payments
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.dueDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            studentCode: true,
          },
        },
        class: {
          select: {
            name: true,
            code: true,
            course: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Student,Code,Email,Class,Course,Description,Amount,Status,Due Date,Paid Date,Payment Method,Reference,Notes\n';
      const csvData = payments.map(payment => {
        return [
          `"${payment.student.firstName} ${payment.student.lastName}"`,
          payment.student.studentCode || '',
          payment.student.email,
          payment.class?.name || '',
          payment.class?.course?.name || '',
          `"${payment.description}"`,
          payment.amount.toString(),
          payment.status,
          payment.dueDate.toISOString().split('T')[0],
          payment.paidDate ? payment.paidDate.toISOString().split('T')[0] : '',
          payment.paymentMethod || '',
          payment.reference || '',
          `"${payment.notes || ''}"`,
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvData;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // For now, fallback to CSV until PDF library is implemented
      const csvHeader = 'Student,Code,Email,Class,Course,Description,Amount,Status,Due Date,Paid Date,Payment Method,Reference,Notes\n';
      const csvData = payments.map(payment => {
        return [
          `"${payment.student.firstName} ${payment.student.lastName}"`,
          payment.student.studentCode || '',
          payment.student.email,
          payment.class?.name || '',
          payment.class?.course?.name || '',
          `"${payment.description}"`,
          payment.amount.toString(),
          payment.status,
          payment.dueDate.toISOString().split('T')[0],
          payment.paidDate ? payment.paidDate.toISOString().split('T')[0] : '',
          payment.paymentMethod || '',
          payment.reference || '',
          `"${payment.notes || ''}"`,
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvData;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payments-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting payments:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
