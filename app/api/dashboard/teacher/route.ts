import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, getTeacherIdForUser, tenantScope } from '@/lib/api-auth';

/**
 * GET /api/dashboard/teacher — dati per la vista docente.
 * TEACHER: risolve il proprio profilo (null → 403) e vede solo le proprie
 * lezioni. Ruoli amministrativi: opzionale ?teacherId= per filtrare.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({
      roles: ['TEACHER', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'SUPERADMIN'],
    });

    let teacherId: string | null = null;
    if (ctx.role === 'TEACHER') {
      teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId) {
        return NextResponse.json(
          { error: 'Profilo docente non trovato' },
          { status: 403 }
        );
      }
    } else {
      const { searchParams } = new URL(request.url);
      teacherId = searchParams.get('teacherId');
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Settimana corrente (lunedì → domenica)
    const weekday = (now.getDay() + 6) % 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const teacherFilter = teacherId ? { teacherId } : {};

    const [todayLessons, pendingAttendance, upcomingHomework, weekLessonsCount] =
      await Promise.all([
        // Lezioni di oggi con classe e conteggio appelli già registrati
        prisma.lesson.findMany({
          where: tenantScope(ctx, {
            ...teacherFilter,
            startTime: { gte: todayStart, lte: todayEnd },
          }),
          include: {
            class: { select: { id: true, name: true } },
            _count: { select: { attendance: true } },
          },
          orderBy: { startTime: 'asc' },
        }),
        // Lezioni passate delle ultime 2 settimane senza alcun record Attendance
        prisma.lesson.findMany({
          where: tenantScope(ctx, {
            ...teacherFilter,
            status: { not: 'CANCELLED' },
            endTime: { gte: twoWeeksAgo, lt: now },
            attendance: { none: {} },
          }),
          include: { class: { select: { id: true, name: true } } },
          orderBy: { startTime: 'desc' },
          take: 20,
        }),
        // Compiti con scadenza futura
        prisma.homework.findMany({
          where: tenantScope(ctx, {
            ...teacherFilter,
            dueDate: { gte: now },
          }),
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
        prisma.lesson.count({
          where: tenantScope(ctx, {
            ...teacherFilter,
            startTime: { gte: weekStart, lt: weekEnd },
          }),
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        todayLessons,
        pendingAttendance,
        upcomingHomework,
        weekLessonsCount,
      },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Dashboard teacher error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
