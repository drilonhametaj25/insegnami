import { NextRequest, NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';
import { prisma } from '@/lib/db';
import { requireAuth, authError } from '@/lib/api-auth';

/** Serializza righe CSV con escaping delle virgolette. */
function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * GET /api/analytics/export?type=&period=&format=csv
 * Export analytics: SOLO CSV (400 su altri formati).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({
      permission: { action: 'read', resource: 'analytics' },
    });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const period = parseInt(searchParams.get('period') || '30', 10);
    const exportFormat = searchParams.get('format') || 'csv';

    if (exportFormat !== 'csv') {
      return NextResponse.json(
        { error: 'Formato non supportato: solo csv' },
        { status: 400 }
      );
    }

    const tenantId = ctx.tenantId;
    const endDate = new Date();
    const startDate = subDays(endDate, isNaN(period) ? 30 : period);
    const filename = `analytics-${type}-${format(endDate, 'yyyyMMdd')}.csv`;

    switch (type) {
      case 'overview': {
        const [totalStudents, totalTeachers, totalClasses, totalLessons, overduePayments, revenue] =
          await Promise.all([
            prisma.student.count({ where: { tenantId, status: 'ACTIVE' } }),
            prisma.teacher.count({ where: { tenantId, status: 'ACTIVE' } }),
            prisma.class.count({ where: { tenantId, isActive: true } }),
            prisma.lesson.count({
              where: { tenantId, startTime: { gte: startDate, lte: endDate } },
            }),
            prisma.payment.count({ where: { tenantId, status: 'OVERDUE' } }),
            prisma.payment.aggregate({
              where: {
                tenantId,
                status: 'PAID',
                createdAt: { gte: startDate, lte: endDate },
              },
              _sum: { amount: true },
            }),
          ]);

        const csv = toCsv([
          ['Metrica', 'Valore'],
          ['Studenti attivi', totalStudents],
          ['Docenti attivi', totalTeachers],
          ['Classi attive', totalClasses],
          ['Lezioni nel periodo', totalLessons],
          ['Pagamenti scaduti', overduePayments],
          ['Ricavi periodo', Number(revenue._sum.amount || 0)],
        ]);
        return csvResponse(csv, filename);
      }

      case 'attendance': {
        const byStatus = await prisma.attendance.groupBy({
          by: ['status'],
          where: {
            lesson: { tenantId },
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: { status: true },
        });
        const csv = toCsv([
          ['Stato', 'Conteggio'],
          ...byStatus.map((row) => [row.status, row._count?.status || 0]),
        ]);
        return csvResponse(csv, filename);
      }

      case 'financial': {
        const byStatus = await prisma.payment.groupBy({
          by: ['status'],
          where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
          _count: { status: true },
          _sum: { amount: true },
        });
        const csv = toCsv([
          ['Stato', 'Conteggio', 'Totale'],
          ...byStatus.map((row) => [
            row.status,
            row._count?.status || 0,
            Number(row._sum?.amount || 0),
          ]),
        ]);
        return csvResponse(csv, filename);
      }

      case 'trends': {
        const [enrollments, lessons] = await Promise.all([
          prisma.student.groupBy({
            by: ['createdAt'],
            where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
            _count: { id: true },
          }),
          prisma.lesson.groupBy({
            by: ['startTime'],
            where: { tenantId, startTime: { gte: startDate, lte: endDate } },
            _count: { id: true },
          }),
        ]);

        const byDay: Record<string, { enrollments: number; lessons: number }> = {};
        for (const row of enrollments) {
          const day = format(row.createdAt, 'yyyy-MM-dd');
          byDay[day] = byDay[day] || { enrollments: 0, lessons: 0 };
          byDay[day].enrollments += row._count?.id || 0;
        }
        for (const row of lessons) {
          const day = format(row.startTime, 'yyyy-MM-dd');
          byDay[day] = byDay[day] || { enrollments: 0, lessons: 0 };
          byDay[day].lessons += row._count?.id || 0;
        }

        const csv = toCsv([
          ['Data', 'Iscrizioni', 'Lezioni'],
          ...Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, counts]) => [day, counts.enrollments, counts.lessons]),
        ]);
        return csvResponse(csv, filename);
      }

      default:
        return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 });
    }
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Analytics export error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
