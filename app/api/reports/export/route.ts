import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can export complete reports
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'overview';
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const tenantId = session.user.tenantId;

    if (reportType === 'overview') {
      // Complete overview report with students, attendance, payments
      const students = await prisma.student.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          parentUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          classes: {
            include: {
              class: {
                select: {
                  name: true,
                  course: { select: { name: true } },
                },
              },
            },
          },
          attendance: {
            select: {
              status: true,
              lesson: {
                select: {
                  startTime: true,
                },
              },
            },
            where: startDate && endDate ? {
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            } : {},
          },
          payments: {
            select: {
              amount: true,
              status: true,
              dueDate: true,
            },
            where: startDate && endDate ? {
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            } : {},
          },
        } as any,
        orderBy: { 
          studentCode: 'asc'
        },
      });

      if (format === 'csv') {
        const csvHeader = 'Student,Email,Parent,Parent Email,Parent Phone,Classes,Total Lessons,Present,Absent,Attendance Rate,Total Payments,Paid Amount,Outstanding Amount,Last Payment\n';
        const csvData = students.map((student: any) => {
          const studentUser = student.user;
          const parentUser = student.parentUser;
          const classes = student.classes.map((sc: any) => sc.class.name).join('; ');
          
          // Calculate attendance stats
          const totalLessons = student.attendance.length;
          const presentCount = student.attendance.filter((a: any) => a.status === 'PRESENT').length;
          const absentCount = student.attendance.filter((a: any) => a.status === 'ABSENT').length;
          const attendanceRate = totalLessons > 0 ? ((presentCount / totalLessons) * 100).toFixed(1) : '0';
          
          // Calculate payment stats
          const totalPayments = student.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          const paidPayments = student.payments
            .filter((p: any) => p.status === 'PAID')
            .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          const outstandingAmount = totalPayments - paidPayments;
          
          // Last payment date
          const lastPayment = student.payments
            .filter((p: any) => p.status === 'PAID')
            .sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];
          
          return [
            `"${studentUser?.firstName || ''} ${studentUser?.lastName || ''}"`,
            studentUser?.email || '',
            `"${parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : ''}"`,
            parentUser?.email || '',
            parentUser?.phone || '',
            `"${classes}"`,
            totalLessons.toString(),
            presentCount.toString(),
            absentCount.toString(),
            `${attendanceRate}%`,
            `€${totalPayments.toFixed(2)}`,
            `€${paidPayments.toFixed(2)}`,
            `€${outstandingAmount.toFixed(2)}`,
            lastPayment ? new Date(lastPayment.dueDate).toLocaleDateString('it-IT') : '',
          ].join(',');
        }).join('\n');

        const csv = csvHeader + csvData;

        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="complete-report-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }
    } else if (reportType === 'financial') {
      // Financial summary report
      const payments = await prisma.payment.findMany({
        where: {
          tenantId,
          ...(startDate && endDate ? {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          } : {}),
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          class: {
            select: {
              name: true,
              course: { select: { name: true } },
            },
          },
        } as any,
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'csv') {
        const csvHeader = 'Month,Student,Class,Course,Description,Amount,Status,Due Date,Paid Date,Outstanding Days\n';
        const csvData = payments.map((payment: any) => {
          const student = payment.student;
          const studentUser = student.user;
          const outstandingDays = payment.status === 'PENDING' ? 
            Math.floor((new Date().getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          
          return [
            new Date(payment.createdAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long' }),
            `"${studentUser?.firstName || ''} ${studentUser?.lastName || ''}"`,
            `"${payment.class?.name || ''}"`,
            `"${payment.class?.course?.name || ''}"`,
            `"${payment.description}"`,
            `€${Number(payment.amount).toFixed(2)}`,
            payment.status,
            new Date(payment.dueDate).toLocaleDateString('it-IT'),
            payment.paidDate ? new Date(payment.paidDate).toLocaleDateString('it-IT') : '',
            outstandingDays > 0 ? outstandingDays.toString() : '',
          ].join(',');
        }).join('\n');

        const csv = csvHeader + csvData;

        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="financial-report-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }
    }

    return NextResponse.json({ error: 'Tipo di report non supportato' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting reports:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
