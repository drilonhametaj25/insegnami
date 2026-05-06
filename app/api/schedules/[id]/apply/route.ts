import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { loadHolidayFingerprints } from '@/lib/scheduling/holidays';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Applica orario (crea lezioni nel calendario)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!['ADMIN', 'DIRECTOR', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { weekCount = 1 } = body; // Numero di settimane da generare

    // Recupera orario con tutti gli slot
    const schedule = await prisma.schedule.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        slots: {
          include: {
            class: true,
            subject: true,
            teacher: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Orario non trovato' },
        { status: 404 }
      );
    }

    if (schedule.status !== 'GENERATED') {
      return NextResponse.json(
        {
          error:
            schedule.status === 'APPLIED'
              ? 'Orario già applicato'
              : 'L\'orario deve prima essere generato',
        },
        { status: 400 }
      );
    }

    if (schedule.slots.length === 0) {
      return NextResponse.json(
        { error: 'L\'orario non contiene slot. Rigenera prima l\'orario.' },
        { status: 400 }
      );
    }

    // Calcola le date per ogni settimana
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);

    // Trova il primo lunedì >= startDate
    let currentDate = new Date(startDate);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 1) {
      // Se non è lunedì, vai al prossimo lunedì
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      currentDate.setDate(currentDate.getDate() + daysUntilMonday);
    }

    // Load holidays once for the whole apply window — O(1) lookup per slot.
    const holidayFp = await loadHolidayFingerprints(session.user.tenantId, startDate, endDate);

    const lessonsToCreate: any[] = [];
    let weeksCreated = 0;
    let skippedHolidays = 0;

    while (currentDate <= endDate && (weekCount === -1 || weeksCreated < weekCount)) {
      // Per ogni slot dell'orario
      for (const slot of schedule.slots) {
        // Calcola la data esatta per questo slot
        const lessonDate = new Date(currentDate);
        lessonDate.setDate(lessonDate.getDate() + (slot.dayOfWeek - 1)); // dayOfWeek: 1=Lun

        // Verifica che sia entro il range
        if (lessonDate > endDate) continue;

        // Skip se cade in un giorno di vacanza (festività nazionale o specifica)
        if (holidayFp.has(lessonDate)) {
          skippedHolidays++;
          continue;
        }

        // Crea ora di inizio e fine
        const [startHour, startMin] = slot.startTime.split(':').map(Number);
        const [endHour, endMin] = slot.endTime.split(':').map(Number);

        const startTime = new Date(lessonDate);
        startTime.setHours(startHour, startMin, 0, 0);

        const endTime = new Date(lessonDate);
        endTime.setHours(endHour, endMin, 0, 0);

        lessonsToCreate.push({
          tenantId: session.user.tenantId,
          title: `${slot.subject.name} - ${slot.class.name}`,
          description: `Lezione generata automaticamente dall'orario "${schedule.name}"`,
          startTime,
          endTime,
          room: slot.room,
          classId: slot.classId,
          teacherId: slot.teacherId,
          status: 'SCHEDULED',
          isRecurring: false, // Ogni lezione è singola
          materials: null,
          homework: null,
          notes: null,
        });
      }

      // Passa alla settimana successiva
      currentDate.setDate(currentDate.getDate() + 7);
      weeksCreated++;
    }

    if (lessonsToCreate.length === 0) {
      return NextResponse.json(
        { error: 'Nessuna lezione da creare nel periodo specificato (potrebbero essere tutte in giorni di vacanza)' },
        { status: 400 }
      );
    }

    // Idempotenza esplicita: rimuoviamo dalle creazioni le combinazioni
    // [classId, startTime] già presenti. createMany con skipDuplicates non
    // funziona qui perché Lesson non ha un unique index su quella tupla,
    // e aggiungerlo retroattivamente potrebbe rompere lezioni manuali.
    const candidates = lessonsToCreate.map((l) => ({ classId: l.classId, startTime: l.startTime }));
    const existing = await prisma.lesson.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: candidates.map((c) => ({ classId: c.classId, startTime: c.startTime })),
      },
      select: { classId: true, startTime: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.classId}|${e.startTime.toISOString()}`));
    const toInsert = lessonsToCreate.filter(
      (l) => !existingKeys.has(`${l.classId}|${l.startTime.toISOString()}`),
    );

    const result = await prisma.lesson.createMany({ data: toInsert });

    // Aggiorna stato orario
    await prisma.schedule.update({
      where: { id },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      lessonsCreated: result.count,
      lessonsSkippedAsDuplicates: lessonsToCreate.length - result.count,
      lessonsSkippedAsHolidays: skippedHolidays,
      weeksCreated,
      message: `Create ${result.count} lezioni per ${weeksCreated} settimana/e (saltate ${skippedHolidays} per vacanze)`,
    });
  } catch (error) {
    console.error('Error applying schedule:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'applicazione dell\'orario' },
      { status: 500 }
    );
  }
}
