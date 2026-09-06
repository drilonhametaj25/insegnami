import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, authError, getTeacherIdForUser } from '@/lib/api-auth';

/**
 * PATCH /api/absence-justifications/[id] — approvazione/rifiuto.
 * Solo staff e docenti. All'approvazione le Attendance ABSENT dello studente
 * nel range dateFrom..dateTo passano a EXCUSED.
 */

const decisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'SUPERADMIN'],
      feature: 'absenceJustifications',
    });

    const { id } = await params;
    const body = await request.json();
    const { action, note } = decisionSchema.parse(body);

    const justification = await prisma.absenceJustification.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!justification) {
      return NextResponse.json({ error: 'Giustificazione non trovata' }, { status: 404 });
    }

    if (justification.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Giustificazione già decisa' },
        { status: 400 }
      );
    }

    // Il docente può decidere solo per gli studenti delle proprie classi
    if (ctx.role === 'TEACHER') {
      const tid = await getTeacherIdForUser(ctx);
      const ownStudent = tid
        ? await prisma.student.findFirst({
            where: {
              id: justification.studentId,
              tenantId: ctx.tenantId,
              classes: { some: { class: { teacherId: tid } } },
            },
            select: { id: true },
          })
        : null;
      if (!ownStudent) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Range giornaliero completo (dateFrom 00:00 → dateTo 23:59)
    const rangeStart = new Date(justification.dateFrom);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(justification.dateTo);
    rangeEnd.setHours(23, 59, 59, 999);

    const [updated] = await prisma.$transaction([
      prisma.absenceJustification.update({
        where: { id: justification.id },
        data: {
          status: newStatus,
          decidedById: ctx.userId,
          decidedAt: new Date(),
          ...(note !== undefined ? { note } : {}),
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentCode: true },
          },
        },
      }),
      // Su approve: le assenze del range diventano EXCUSED (solo ABSENT — le
      // presenze registrate non vengono riscritte)
      ...(action === 'approve'
        ? [
            prisma.attendance.updateMany({
              where: {
                studentId: justification.studentId,
                status: 'ABSENT',
                lesson: {
                  tenantId: ctx.tenantId,
                  startTime: { gte: rangeStart, lte: rangeEnd },
                },
              },
              data: { status: 'EXCUSED' },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Errore PATCH absence-justifications:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
