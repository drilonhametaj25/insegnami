import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    const user = session?.user;
    
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Get all classes with related data
    const classes = await prisma.class.findMany({
      where: { tenantId },
      include: {
        course: {
          select: {
            name: true,
            code: true,
            level: true,
            category: true
          }
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            teacherCode: true
          }
        },
        _count: {
          select: {
            students: {
              where: { isActive: true }
            },
            lessons: true
          }
        },
        students: {
          where: { isActive: true },
          take: 5, // Limit for preview
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                studentCode: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (format === 'json') {
      const jsonData = classes.map(cls => ({
        id: cls.id,
        name: cls.name,
        code: cls.code,
        course: {
          name: cls.course.name,
          code: cls.course.code,
          level: cls.course.level,
          category: cls.course.category
        },
        teacher: {
          name: `${cls.teacher.firstName} ${cls.teacher.lastName}`,
          email: cls.teacher.email,
          code: cls.teacher.teacherCode
        },
        startDate: cls.startDate.toISOString().split('T')[0],
        endDate: cls.endDate ? cls.endDate.toISOString().split('T')[0] : null,
        maxStudents: cls.maxStudents,
        currentStudents: cls._count.students,
        totalLessons: cls._count.lessons,
        isActive: cls.isActive,
        capacityPercentage: Math.round((cls._count.students / cls.maxStudents) * 100),
        sampleStudents: cls.students.map(s => ({
          name: `${s.student.firstName} ${s.student.lastName}`,
          code: s.student.studentCode,
          enrolledAt: s.enrolledAt.toISOString().split('T')[0]
        })),
        createdAt: cls.createdAt.toISOString(),
        updatedAt: cls.updatedAt.toISOString()
      }));

      return NextResponse.json(
        {
          classes: jsonData,
          metadata: {
            totalClasses: classes.length,
            exportedAt: new Date().toISOString(),
            tenantId
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="classes-export-${new Date().toISOString().split('T')[0]}.json"`
          }
        }
      );
    }

    // CSV format
    const csvHeaders = [
      'ID',
      'Nome Classe',
      'Codice Classe',
      'Corso',
      'Codice Corso',
      'Livello',
      'Categoria',
      'Insegnante',
      'Email Insegnante',
      'Codice Insegnante',
      'Data Inizio',
      'Data Fine',
      'Capacità Massima',
      'Studenti Attuali',
      'Lezioni Totali',
      'Percentuale Riempimento',
      'Stato',
      'Data Creazione',
      'Ultimo Aggiornamento'
    ].join(',');

    const csvRows = classes.map(cls => {
      const capacityPercentage = Math.round((cls._count.students / cls.maxStudents) * 100);
      
      return [
        cls.id,
        `"${cls.name}"`,
        cls.code,
        `"${cls.course.name}"`,
        cls.course.code,
        cls.course.level || '',
        cls.course.category || '',
        `"${cls.teacher.firstName} ${cls.teacher.lastName}"`,
        cls.teacher.email,
        cls.teacher.teacherCode,
        cls.startDate.toISOString().split('T')[0],
        cls.endDate ? cls.endDate.toISOString().split('T')[0] : '',
        cls.maxStudents,
        cls._count.students,
        cls._count.lessons,
        `${capacityPercentage}%`,
        cls.isActive ? 'Attiva' : 'Inattiva',
        cls.createdAt.toISOString().split('T')[0],
        cls.updatedAt.toISOString().split('T')[0]
      ].join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    logger.info('Classes exported successfully', {
      tenantId,
      format,
      classCount: classes.length,
      exportedBy: user.id
    });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="classes-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    logger.error('Error exporting classes:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
