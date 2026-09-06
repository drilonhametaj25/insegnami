import { NextRequest, NextResponse } from 'next/server';
import { auth, getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { z } from 'zod';
import { getTeacherIdForUser, type AuthContext } from '@/lib/api-auth';
import {
  findLessonConflicts,
  conflictMessage,
  type LessonConflict,
} from '@/lib/lessons/conflicts';
import {
  buildRRuleString,
  normalizeRRuleString,
  generateOccurrences,
  isRRuleString,
  MAX_OCCURRENCES,
} from '@/lib/lessons/recurrence';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Solo staff e docenti possono creare serie di lezioni
    if (!['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    const body = await request.json();
    const {
      title,
      description,
      classId,
      teacherId,
      startTime,
      endTime,
      room,
      recurrence,
      recurrenceRule,
    } = body;

    // Validazione input: serve una RRULE canonica oppure l'oggetto recurrence
    if (!title || !classId || !teacherId || !startTime || !endTime || (!recurrence && !recurrenceRule)) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti' },
        { status: 400 }
      );
    }

    // Verify class and teacher exist and belong to tenant
    const [classExists, teacherExists] = await Promise.all([
      prisma.class.findFirst({
        where: { id: classId, tenantId }
      }),
      prisma.teacher.findFirst({
        where: { id: teacherId, tenantId }
      })
    ]);

    if (!classExists || !teacherExists) {
      return NextResponse.json(
        { error: 'Classe o docente non trovato' },
        { status: 404 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const lessonDuration = endDate.getTime() - startDate.getTime();

    // Formato canonico: stringa RRULE (con DTSTART). Accettiamo sia la RRULE
    // già costruita dal client sia il legacy oggetto recurrence del form.
    let canonicalRule: string;
    try {
      canonicalRule = isRRuleString(recurrenceRule)
        ? normalizeRRuleString(recurrenceRule, startDate)
        : buildRRuleString(recurrence, startDate);
    } catch {
      return NextResponse.json(
        { error: 'Regola di ricorrenza non valida' },
        { status: 400 }
      );
    }

    // Occorrenze generate eager via rrule (UNTIL/COUNT rispettati, max 52)
    const occurrenceDates = generateOccurrences(canonicalRule, {
      dtstart: startDate,
      max: MAX_OCCURRENCES,
    });

    const lessons = occurrenceDates.map((occurrenceStart) => ({
      tenantId,
      classId,
      teacherId,
      title,
      description,
      startTime: occurrenceStart,
      endTime: new Date(occurrenceStart.getTime() + lessonDuration),
      room,
      isRecurring: true,
      status: 'SCHEDULED' as const,
    }));

    if (lessons.length === 0) {
      return NextResponse.json(
        { error: 'Nessuna lezione generata con i parametri forniti' },
        { status: 400 }
      );
    }

    // Conflitti aula/docente su ogni occorrenza generata, PRIMA di qualsiasi
    // scrittura: al primo conflitto nessuna lezione viene creata.
    for (const occurrence of lessons) {
      const conflicts = await findLessonConflicts({
        tenantId,
        teacherId,
        room: room ?? null,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: conflictMessage(conflicts), conflicts },
          { status: 409 }
        );
      }
    }

    // Create parent lesson (template)
    const parentLesson = await prisma.lesson.create({
      data: {
        tenantId,
        classId,
        teacherId,
        title: `${title} (Serie)`,
        description: `Serie ricorrente - ${description || ''}`,
        startTime: startDate,
        endTime: endDate,
        room,
        isRecurring: true,
        status: 'SCHEDULED',
        recurrenceRule: canonicalRule,
      },
      include: {
        class: {
          include: {
            course: true
          }
        },
        teacher: true
      }
    });

    // Create all lesson occurrences
    const createdLessons = await prisma.lesson.createMany({
      data: lessons.map(lesson => ({
        ...lesson,
        parentLessonId: parentLesson.id,
        recurrenceRule: canonicalRule,
      }))
    });

    // Fetch the created lessons with includes for response
    const allLessons = await prisma.lesson.findMany({
      where: {
        OR: [
          { id: parentLesson.id },
          { parentLessonId: parentLesson.id }
        ]
      },
      include: {
        class: {
          include: {
            course: true
          }
        },
        teacher: true
      }
    });

    return NextResponse.json(allLessons, { status: 201 });

  } catch (error) {
    console.error('Errore nella creazione lezioni ricorrenti:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// Schema per la modifica di una serie ricorrente.
// startTime/endTime vengono applicati come DELTA rispetto alla lezione di
// riferimento (stesso shift per ogni occorrenza), gli altri campi come valore.
const seriesPatchSchema = z.object({
  lessonId: z.string().min(1, 'lessonId richiesto'),
  scope: z.enum(['single', 'series', 'future']),
  data: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      room: z.string().optional(),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      teacherId: z.string().optional(),
      status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
      message: 'Almeno un campo da aggiornare è richiesto',
    }),
});

/**
 * PATCH /api/lessons/recurring — modifica una serie di lezioni ricorrenti.
 *
 * Body: { lessonId, scope: 'single' | 'series' | 'future', data: {...} }
 * - single: solo la lezione di riferimento
 * - series: radice + tutte le occorrenze figlie
 * - future: le occorrenze con startTime >= lezione di riferimento
 * Le lezioni COMPLETED/CANCELLED non vengono mai riscritte.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Solo admin e docenti possono modificare le lezioni (come il PUT singolo)
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const { lessonId, scope, data } = seriesPatchSchema.parse(body);

    // Lezione di riferimento, scoped sul tenant
    const reference = await prisma.lesson.findFirst({
      where: { id: lessonId, tenantId: session.user.tenantId },
    });

    if (!reference) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // I docenti possono modificare solo le proprie lezioni
    // SECURITY: Lesson.teacherId referenzia Teacher.id, NON User.id.
    if (session.user.role === 'TEACHER') {
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;
      const tid = await getTeacherIdForUser(ctx);
      if (!tid || reference.teacherId !== tid) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    // Se cambia il docente, deve esistere nel tenant
    if (data.teacherId) {
      const teacherExists = await prisma.teacher.findFirst({
        where: { id: data.teacherId, tenantId: session.user.tenantId },
      });
      if (!teacherExists) {
        return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
      }
    }

    // Radice della serie: la lezione stessa se è il template
    const rootId = reference.parentLessonId ?? reference.id;

    // Tutta la serie: serve anche per escluderla dai confronti di conflitto
    const seriesLessons = await prisma.lesson.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [{ id: rootId }, { parentLessonId: rootId }],
      },
      orderBy: { startTime: 'asc' },
    });
    const seriesIds = seriesLessons.map((l) => l.id);

    // Selezione delle occorrenze in base allo scope
    let candidates;
    if (scope === 'single') {
      candidates = seriesLessons.filter((l) => l.id === reference.id);
    } else if (scope === 'future') {
      candidates = seriesLessons.filter((l) => l.startTime >= reference.startTime);
    } else {
      candidates = seriesLessons;
    }

    // Non riscrivere la storia: escludi COMPLETED e CANCELLED
    const targets = candidates.filter(
      (l) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED'
    );

    if (targets.length === 0) {
      return NextResponse.json({ updated: 0, scope });
    }

    // startTime/endTime applicati come DELTA rispetto alla lezione di riferimento
    const deltaStart = data.startTime
      ? new Date(data.startTime).getTime() - reference.startTime.getTime()
      : 0;
    const deltaEnd = data.endTime
      ? new Date(data.endTime).getTime() - reference.endTime.getTime()
      : 0;

    // Pre-calcolo dei nuovi orari per ogni occorrenza
    const planned = targets.map((target) => ({
      target,
      newStart: data.startTime
        ? new Date(target.startTime.getTime() + deltaStart)
        : target.startTime,
      newEnd: data.endTime
        ? new Date(target.endTime.getTime() + deltaEnd)
        : target.endTime,
    }));

    // Coerenza dell'intervallo risultante per ogni occorrenza
    for (const { target, newStart, newEnd } of planned) {
      if (newStart >= newEnd) {
        return NextResponse.json(
          { error: `Intervallo orario non valido per la lezione ${target.id}` },
          { status: 400 }
        );
      }
    }

    // Conflict detection (aula/docente) per OGNI occorrenza, escludendo
    // TUTTE le lezioni della serie: i vecchi slot vengono spostati insieme,
    // quindi non devono generare falsi positivi.
    const needsConflictCheck = Boolean(
      data.startTime || data.endTime || data.room !== undefined || data.teacherId
    );
    if (needsConflictCheck) {
      const allConflicts: { lessonId: string; conflicts: LessonConflict[] }[] = [];
      for (const { target, newStart, newEnd } of planned) {
        const conflicts = await findLessonConflicts({
          tenantId: session.user.tenantId,
          teacherId: data.teacherId ?? target.teacherId,
          room: data.room !== undefined ? data.room : target.room,
          startTime: newStart,
          endTime: newEnd,
          excludeLessonIds: seriesIds,
        });
        if (conflicts.length > 0) {
          allConflicts.push({ lessonId: target.id, conflicts });
        }
      }
      if (allConflicts.length > 0) {
        // Nessuna scrittura in presenza di conflitti
        return NextResponse.json(
          {
            error: conflictMessage(allConflicts[0].conflicts),
            conflicts: allConflicts,
          },
          { status: 400 }
        );
      }
    }

    // Scrittura atomica di tutte le occorrenze
    await prisma.$transaction(async (tx) => {
      for (const { target, newStart, newEnd } of planned) {
        await tx.lesson.update({
          where: { id: target.id },
          data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.room !== undefined && { room: data.room }),
            ...(data.teacherId !== undefined && { teacherId: data.teacherId }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.startTime && { startTime: newStart }),
            ...(data.endTime && { endTime: newEnd }),
          },
        });
      }
    });

    return NextResponse.json({ updated: targets.length, scope });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Errore nella modifica della serie ricorrente:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
