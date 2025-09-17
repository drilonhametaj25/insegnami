import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can export attendance
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const classId = searchParams.get('classId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (classId) {
      where.lesson = {
        classId: classId,
      };
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (status) {
      where.status = status;
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where,
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
            parentUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        lesson: {
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
            teacher: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      } as any,
      orderBy: [
        { createdAt: 'desc' },
        { lesson: { startTime: 'desc' } },
      ],
    });

    if (format === 'csv') {
      // Generate CSV with comprehensive attendance data
      const csvHeader = 'Date,Student,Student Code,Student Email,Parent,Parent Email,Parent Phone,Class,Course,Teacher,Lesson Title,Status,Notes,Recorded At\n';
      const csvData = attendanceRecords.map((record: any) => {
        const student = record.student;
        const studentUser = student.user;
        const parentUser = student.parentUser;
        const lesson = record.lesson;
        const teacher = lesson.teacher;
        const classInfo = lesson.class;
        
        return [
          lesson.startTime ? new Date(lesson.startTime).toLocaleDateString('it-IT') : '',
          `"${studentUser?.firstName || ''} ${studentUser?.lastName || ''}"`,
          student.studentCode || '',
          studentUser?.email || '',
          `"${parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : ''}"`,
          parentUser?.email || '',
          parentUser?.phone || '',
          `"${classInfo?.name || ''}"`,
          `"${classInfo?.course?.name || ''}"`,
          `"${teacher ? `${teacher.firstName} ${teacher.lastName}` : ''}"`,
          `"${lesson.title || ''}"`,
          record.status,
          `"${record.notes || ''}"`,
          new Date(record.createdAt).toLocaleString('it-IT'),
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvData;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Formato non supportato' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error exporting attendance:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
