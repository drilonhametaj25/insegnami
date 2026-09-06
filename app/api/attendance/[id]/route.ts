import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  requireAuth,
  authError,
  getTeacherIdForUser,
  type AuthContext,
} from '@/lib/api-auth';

const updateSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  notes: z.string().max(1000).nullable().optional(),
  arrivedAt: z.string().datetime().nullable().optional(),
  leftAt: z.string().datetime().nullable().optional(),
});

/**
 * Carica il record con la lezione e applica lo scoping:
 * tenant via lesson.tenantId; TEACHER solo se titolare della lezione.
 */
async function loadRecord(ctx: AuthContext, id: string) {
  const record = await prisma.attendance.findFirst({
    where: {
      id,
      ...(ctx.isSuperAdmin ? {} : { lesson: { tenantId: ctx.tenantId } }),
    },
    include: {
      lesson: { select: { id: true, teacherId: true, tenantId: true } },
    },
  });

  if (!record) {
    return { record: null, response: NextResponse.json({ error: 'Record non trovato' }, { status: 404 }) };
  }

  if (ctx.role === 'TEACHER') {
    const teacherId = await getTeacherIdForUser(ctx);
    if (!teacherId || record.lesson.teacherId !== teacherId) {
      return { record: null, response: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) };
    }
  }

  return { record, response: null };
}

// PUT /api/attendance/[id] — aggiorna status/notes/arrivedAt/leftAt.
// NB: nessuna logica ore/pacchetti qui (di un'altra wave).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth({
      permission: { action: 'update', resource: 'attendance' },
    });

    const { id } = await params;
    const { record, response } = await loadRecord(ctx, id);
    if (!record) return response!;

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.arrivedAt !== undefined
          ? { arrivedAt: data.arrivedAt ? new Date(data.arrivedAt) : null }
          : {}),
        ...(data.leftAt !== undefined
          ? { leftAt: data.leftAt ? new Date(data.leftAt) : null }
          : {}),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lesson: {
          select: { id: true, title: true, startTime: true, endTime: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Attendance PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/attendance/[id] — elimina un record di presenza.
// TEACHER solo se titolare della lezione; ruoli amministrativi ok.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'TEACHER'],
    });

    const { id } = await params;
    const { record, response } = await loadRecord(ctx, id);
    if (!record) return response!;

    await prisma.attendance.delete({ where: { id } });

    return NextResponse.json({ message: 'Record eliminato con successo' });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Attendance DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
