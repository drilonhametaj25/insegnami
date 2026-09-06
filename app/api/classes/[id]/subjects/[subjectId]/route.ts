import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, authError, type AuthContext } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string; subjectId: string }>;
}

const updateSchema = z.object({
  teacherId: z.string().min(1).optional(),
  weeklyHours: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(40).optional()
  ),
});

// Risolve l'assegnazione con scoping tenant via classe
async function findAssignmentScoped(ctx: AuthContext, classId: string, subjectId: string) {
  return prisma.classSubject.findFirst({
    where: {
      classId,
      subjectId,
      class: ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId },
    },
    include: { class: { select: { id: true, tenantId: true } } },
  });
}

// PUT /api/classes/[id]/subjects/[subjectId] — aggiorna docente/ore
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'class' } });
    const { id, subjectId } = await params;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { teacherId, weeklyHours } = parsed.data;

    const assignment = await findAssignmentScoped(ctx, id, subjectId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assegnazione non trovata' }, { status: 404 });
    }

    // Validazione tenant sul docente (se cambia)
    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, tenantId: assignment.class.tenantId },
        select: { id: true },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: 'Docente non trovato in questa scuola' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.classSubject.update({
      where: { id: assignment.id },
      data: {
        ...(teacherId ? { teacherId } : {}),
        ...(weeklyHours !== undefined ? { weeklyHours } : {}),
      },
      include: {
        subject: {
          select: { id: true, name: true, code: true, color: true, weeklyHours: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('ClassSubject PUT error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/classes/[id]/subjects/[subjectId] — rimuove la materia dalla classe
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'class' } });
    const { id, subjectId } = await params;

    const assignment = await findAssignmentScoped(ctx, id, subjectId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assegnazione non trovata' }, { status: 404 });
    }

    await prisma.classSubject.delete({ where: { id: assignment.id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('ClassSubject DELETE error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
