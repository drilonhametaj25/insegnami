import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admin and superadmin can export teacher data
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Get all teachers with their related data
    const teachers = await prisma.teacher.findMany({
      where: {
        tenantId
      },
      include: {
        classes: {
          include: {
            course: {
              select: {
                name: true
              }
            }
          }
        },
        lessons: {
          select: {
            id: true
          }
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    const exportData = teachers.map(teacher => ({
      'ID': teacher.teacherCode,
      'Nome': teacher.firstName,
      'Cognome': teacher.lastName,
      'Email': teacher.email,
      'Telefono': teacher.phone || '',
      'Indirizzo': teacher.address || '',
      'Stato': getStatusLabel(teacher.status),
      'Data Assunzione': new Date(teacher.hireDate).toLocaleDateString('it-IT'),
      'Tipo Contratto': teacher.contractType || '',
      'Qualifiche': teacher.qualifications || '',
      'Specializzazioni': teacher.specializations || '',
      'Tariffa Oraria': teacher.hourlyRate ? `€${teacher.hourlyRate}` : '',
      'Numero Classi': teacher.classes.length,
      'Numero Lezioni': teacher.lessons.length,
      'Classi Assegnate': teacher.classes.map(c => `${c.name} (${c.course.name})`).join('; '),
      'Data Creazione': new Date(teacher.createdAt).toLocaleDateString('it-IT'),
      'Ultimo Aggiornamento': new Date(teacher.updatedAt).toLocaleDateString('it-IT')
    }));

    if (format === 'csv') {
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => {
          const value = (row as any)[header] || '';
          // Escape commas and quotes in CSV
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(','))
      ].join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="teachers-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // For now, just return JSON if not CSV
    return NextResponse.json(exportData);

  } catch (error) {
    console.error('Teacher export error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'esportazione' },
      { status: 500 }
    );
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Attivo';
    case 'INACTIVE': return 'Inattivo';
    case 'SUSPENDED': return 'Sospeso';
    default: return status;
  }
}
