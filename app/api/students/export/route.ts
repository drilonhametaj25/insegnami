import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can export students
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    const students = await prisma.student.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      include: {
        classes: {
          include: {
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
        },
        payments: {
          select: {
            amount: true,
            status: true,
            dueDate: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Nome,Cognome,Email,Telefono,Data Nascita,Indirizzo,Nome Genitore,Email Genitore,Telefone Genitore,Codice,Data Iscrizione,Stato,Classi,Pagamenti Totali,Note Mediche,Esigenze Speciali\n';
      const csvData = students.map(student => {
        const classes = student.classes.map(sc => sc.class.name).join('; ');
        const totalPayments = student.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        return [
          `"${student.firstName}"`,
          `"${student.lastName}"`,
          student.email || '',
          student.phone || '',
          student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
          `"${student.address || ''}"`,
          `"${student.parentName || ''}"`,
          student.parentEmail || '',
          student.parentPhone || '',
          student.studentCode || '',
          new Date(student.enrollmentDate).toISOString().split('T')[0],
          student.status,
          `"${classes}"`,
          totalPayments.toFixed(2),
          `"${student.medicalNotes || ''}"`,
          `"${student.specialNeeds || ''}"`,
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvData;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="students-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'xlsx') {
      // For now, fallback to CSV (can implement XLSX later)
      const csvHeader = 'Nome,Cognome,Email,Telefono,Data Nascita,Indirizzo,Nome Genitore,Email Genitore,Telefono Genitore,Codice,Data Iscrizione,Stato,Classi,Pagamenti Totali,Note Mediche,Esigenze Speciali\n';
      const csvData = students.map(student => {
        const classes = student.classes.map(sc => sc.class.name).join('; ');
        const totalPayments = student.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        return [
          `"${student.firstName}"`,
          `"${student.lastName}"`,
          student.email || '',
          student.phone || '',
          student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
          `"${student.address || ''}"`,
          `"${student.parentName || ''}"`,
          student.parentEmail || '',
          student.parentPhone || '',
          student.studentCode || '',
          new Date(student.enrollmentDate).toISOString().split('T')[0],
          student.status,
          `"${classes}"`,
          totalPayments.toFixed(2),
          `"${student.medicalNotes || ''}"`,
          `"${student.specialNeeds || ''}"`,
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvData;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="students-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Formato non supportato' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error exporting students:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
