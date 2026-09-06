import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, authError, type AuthContext } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  subjectId: z.string().min(1, 'Materia richiesta'),
});

// Risolve il docente con scoping tenant (SUPERADMIN bypassa)
async function findTeacherScoped(ctx: AuthContext, teacherId: string) {
  return prisma.teacher.findFirst({
    where: {
      id: teacherId,
      ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }),
    },
    select: { id: true, tenantId: true },
  });
}

// GET /api/teachers/[id]/subjects — materie insegnate dal docente
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'teacher' } });
    const { id } = await params;

    const teacher = await findTeacherScoped(ctx, id);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
    }

    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { teacherId: teacher.id },
      include: {
        subject: {
          select: { id: true, name: true, code: true, color: true, isActive: true },
        },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    return NextResponse.json({
      data: teacherSubjects,
      meta: { total: teacherSubjects.length },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('TeacherSubjects GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// POST /api/teachers/[id]/subjects — collega una materia al docente
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'teacher' } });
    const { id } = await params;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { subjectId } = parsed.data;

    const teacher = await findTeacherScoped(ctx, id);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
    }

    // Validazione tenant sulla materia (stesso tenant del docente)
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, tenantId: teacher.tenantId },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json(
        { error: 'Materia non trovata in questa scuola' },
        { status: 400 }
      );
    }

    const existing = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacher.id, subjectId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Materia già associata a questo docente' },
        { status: 409 }
      );
    }

    const created = await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subjectId },
      include: {
        subject: {
          select: { id: true, name: true, code: true, color: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    const r = authError(error);
    if (r) return r;
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Materia già associata a questo docente' },
        { status: 409 }
      );
    }
    console.error('TeacherSubjects POST error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/teachers/[id]/subjects?subjectId=... — scollega una materia
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'teacher' } });
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    let subjectId = searchParams.get('subjectId');
    if (!subjectId) {
      // Fallback: subjectId nel body JSON
      const body = await request.json().catch(() => null);
      subjectId = body?.subjectId ?? null;
    }
    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId richiesto' }, { status: 400 });
    }

    const teacher = await findTeacherScoped(ctx, id);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
    }

    const deleted = await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacher.id, subjectId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Associazione non trovata' }, { status: 404 });
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('TeacherSubjects DELETE error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
