import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  requireAuth,
  authError,
  getChildStudentIds,
  getStudentIdForUser,
  getTeacherIdForUser,
} from '@/lib/api-auth';

/**
 * Giustificazione assenze (feature di piano 'absenceJustifications').
 *
 * GET  — lista filtrata per ruolo: genitore/studente le proprie, docente
 *        quelle degli studenti delle sue classi, staff tutto il tenant.
 * POST — richiesta dal genitore (per un figlio) o dallo studente maggiorenne.
 */

const JUSTIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

const createSchema = z.object({
  studentId: z.string().optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  reason: z.string().min(3, 'Motivo richiesto'),
  note: z.string().optional(),
});

const includeShape = {
  student: {
    select: { id: true, firstName: true, lastName: true, studentCode: true },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  decidedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ feature: 'absenceJustifications' });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const studentIdParam = searchParams.get('studentId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: any = { tenantId: ctx.tenantId };
    if (status && (JUSTIFICATION_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }

    if (ctx.role === 'PARENT') {
      const childIds = await getChildStudentIds(ctx);
      if (studentIdParam) {
        if (!childIds.includes(studentIdParam)) {
          return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }
        where.studentId = studentIdParam;
      } else {
        where.studentId = { in: childIds.length > 0 ? childIds : ['__none__'] };
      }
    } else if (ctx.role === 'STUDENT') {
      const sid = await getStudentIdForUser(ctx);
      where.studentId = sid ?? '__none__';
    } else if (ctx.role === 'TEACHER') {
      // Solo le giustificazioni degli studenti delle proprie classi
      const tid = await getTeacherIdForUser(ctx);
      where.student = {
        classes: { some: { class: { teacherId: tid ?? '__none__' } } },
      };
      if (studentIdParam) where.studentId = studentIdParam;
    } else {
      // ADMIN / DIRECTOR / SECRETARY / SUPERADMIN: tutto il tenant
      if (studentIdParam) where.studentId = studentIdParam;
    }

    const [items, total] = await Promise.all([
      prisma.absenceJustification.findMany({
        where,
        include: includeShape,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.absenceJustification.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Errore GET absence-justifications:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth({
      roles: ['PARENT', 'STUDENT'],
      feature: 'absenceJustifications',
    });

    const body = await request.json();
    const parsed = createSchema.parse(body);

    if (parsed.dateFrom > parsed.dateTo) {
      return NextResponse.json(
        { error: 'Intervallo date non valido' },
        { status: 400 }
      );
    }

    let studentId: string;

    if (ctx.role === 'PARENT') {
      const childIds = await getChildStudentIds(ctx);
      if (childIds.length === 0) {
        return NextResponse.json({ error: 'Nessun figlio collegato' }, { status: 403 });
      }
      // Con più figli lo studentId è obbligatorio; con uno solo è implicito
      studentId = parsed.studentId ?? (childIds.length === 1 ? childIds[0] : '');
      if (!studentId || !childIds.includes(studentId)) {
        return NextResponse.json(
          { error: 'Seleziona un figlio valido' },
          { status: 400 }
        );
      }
    } else {
      // STUDENT: solo per sé stesso e solo se maggiorenne
      const sid = await getStudentIdForUser(ctx);
      if (!sid) {
        return NextResponse.json({ error: 'Profilo studente non trovato' }, { status: 403 });
      }
      const student = await prisma.student.findFirst({
        where: { id: sid, tenantId: ctx.tenantId },
        select: { dateOfBirth: true },
      });
      const dob = student?.dateOfBirth ? new Date(student.dateOfBirth) : null;
      const age = dob
        ? (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
        : 0;
      if (!dob || age < 18) {
        return NextResponse.json(
          { error: 'Solo gli studenti maggiorenni possono giustificare le proprie assenze' },
          { status: 403 }
        );
      }
      studentId = sid;
    }

    const justification = await prisma.absenceJustification.create({
      data: {
        tenantId: ctx.tenantId,
        studentId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
        reason: parsed.reason,
        note: parsed.note ?? null,
        status: 'PENDING',
        requestedById: ctx.userId,
      },
      include: includeShape,
    });

    return NextResponse.json({ data: justification }, { status: 201 });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Errore POST absence-justifications:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
