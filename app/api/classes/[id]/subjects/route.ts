import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, authError, type AuthContext } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST body: teacherId opzionale → fallback sul docente titolare della classe
const createSchema = z.object({
  subjectId: z.string().min(1, 'Materia richiesta'),
  teacherId: z.string().min(1).optional(),
  weeklyHours: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(40).optional()
  ),
});

// Risolve la classe con scoping tenant (SUPERADMIN bypassa)
async function findClassScoped(ctx: AuthContext, classId: string) {
  return prisma.class.findFirst({
    where: {
      id: classId,
      ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }),
    },
    select: { id: true, tenantId: true, teacherId: true },
  });
}

// GET /api/classes/[id]/subjects — materie della classe con docente assegnato
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'class' } });
    const { id } = await params;

    const cls = await findClassScoped(ctx, id);
    if (!cls) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    const classSubjects = await prisma.classSubject.findMany({
      where: { classId: cls.id },
      include: {
        subject: {
          select: { id: true, name: true, code: true, color: true, weeklyHours: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    return NextResponse.json({
      data: classSubjects,
      meta: { total: classSubjects.length },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('ClassSubjects GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// POST /api/classes/[id]/subjects — assegna una materia alla classe
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'class' } });
    const { id } = await params;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { subjectId, teacherId, weeklyHours } = parsed.data;

    const cls = await findClassScoped(ctx, id);
    if (!cls) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // Validazione tenant sulla materia (sempre sul tenant della classe)
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, tenantId: cls.tenantId },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json(
        { error: 'Materia non trovata in questa scuola' },
        { status: 400 }
      );
    }

    // teacherId opzionale: default = docente titolare della classe
    const effectiveTeacherId = teacherId ?? cls.teacherId;
    const teacher = await prisma.teacher.findFirst({
      where: { id: effectiveTeacherId, tenantId: cls.tenantId },
      select: { id: true },
    });
    if (!teacher) {
      return NextResponse.json(
        { error: 'Docente non trovato in questa scuola' },
        { status: 400 }
      );
    }

    // Duplicato esplicito su @@unique([classId, subjectId]) → 409 chiaro
    const existing = await prisma.classSubject.findFirst({
      where: { classId: cls.id, subjectId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Materia già assegnata a questa classe' },
        { status: 409 }
      );
    }

    const created = await prisma.classSubject.create({
      data: {
        classId: cls.id,
        subjectId,
        teacherId: effectiveTeacherId,
        weeklyHours: weeklyHours ?? 1,
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

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    const r = authError(error);
    if (r) return r;
    // Race residua sul vincolo unico → 409 coerente col check esplicito
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Materia già assegnata a questa classe' },
        { status: 409 }
      );
    }
    console.error('ClassSubjects POST error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
