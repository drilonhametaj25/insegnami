import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireAuth,
  authError,
  getTeacherIdForUser,
  tenantScope,
} from '@/lib/api-auth';

/** Calcola l'inizio del periodo in base al timeframe richiesto. */
function timeframeStart(timeframe: string, now: Date): Date {
  const start = new Date(now);
  switch (timeframe) {
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'semester':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'month':
    default:
      start.setMonth(start.getMonth() - 1);
      break;
  }
  return start;
}

/**
 * GET /api/attendance/summary/class/[id]?timeframe=week|month|semester|year
 * Riassunto presenze di una classe. Admin: tutte; TEACHER: solo le proprie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'],
    });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'month';

    const cls = await prisma.class.findFirst({
      where: tenantScope(ctx, { id }),
      include: {
        students: {
          where: { isActive: true },
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                studentCode: true,
              },
            },
          },
        },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // TEACHER: solo le classi di cui è titolare
    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId || cls.teacherId !== teacherId) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    const now = new Date();
    const since = timeframeStart(timeframe, now);

    const lessonWhere = {
      classId: cls.id,
      tenantId: cls.tenantId,
      status: { not: 'CANCELLED' as const },
      startTime: { gte: since, lte: now },
    };

    const [totalLessons, attendanceRecords] = await Promise.all([
      prisma.lesson.count({ where: lessonWhere }),
      prisma.attendance.findMany({
        where: { lesson: lessonWhere },
        select: { studentId: true, status: true },
      }),
    ]);

    // Conteggi per studente
    const byStudent = new Map<
      string,
      { present: number; absent: number; late: number; excused: number }
    >();
    for (const rec of attendanceRecords) {
      const counts =
        byStudent.get(rec.studentId) ?? {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      if (rec.status === 'PRESENT') counts.present += 1;
      else if (rec.status === 'ABSENT') counts.absent += 1;
      else if (rec.status === 'LATE') counts.late += 1;
      else if (rec.status === 'EXCUSED') counts.excused += 1;
      byStudent.set(rec.studentId, counts);
    }

    const studentSummaries = cls.students.map((enrollment) => {
      const student = enrollment.student;
      const counts =
        byStudent.get(student.id) ?? {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      const recorded =
        counts.present + counts.absent + counts.late + counts.excused;
      const denominator = totalLessons > 0 ? totalLessons : recorded;
      const attended = counts.present + counts.late;
      const attendanceRate =
        denominator > 0 ? Math.min((attended / denominator) * 100, 100) : 0;

      return {
        studentId: student.id,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          registrationNumber: student.studentCode,
        },
        totalLessons,
        presentCount: counts.present,
        absentCount: counts.absent,
        lateCount: counts.late,
        excusedCount: counts.excused,
        attendanceRate,
        recentRecords: [],
      };
    });

    const averageAttendanceRate =
      studentSummaries.length > 0
        ? studentSummaries.reduce((sum, s) => sum + s.attendanceRate, 0) /
          studentSummaries.length
        : 0;

    return NextResponse.json({
      classId: cls.id,
      class: {
        id: cls.id,
        name: cls.name,
      },
      totalStudents: cls.students.length,
      totalLessons,
      averageAttendanceRate,
      studentSummaries,
      recentLessons: [],
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Attendance class summary error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
