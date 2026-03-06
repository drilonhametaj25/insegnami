import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  generateSchedule,
  ScheduleInput,
  ScheduleConfig,
  TimeSlot,
  DEFAULT_CONFIG,
} from '@/lib/scheduling';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Genera orario usando algoritmo CSP
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

    // Recupera orario
    const schedule = await prisma.schedule.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Orario non trovato' },
        { status: 404 }
      );
    }

    if (schedule.status === 'APPLIED') {
      return NextResponse.json(
        { error: 'Non è possibile rigenerare un orario già applicato' },
        { status: 400 }
      );
    }

    // Recupera dati necessari per la generazione
    const [classes, teachers, subjects, classSubjects, timeSlotConfigs] =
      await Promise.all([
        // Classi attive
        prisma.class.findMany({
          where: {
            tenantId: session.user.tenantId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            code: true,
          },
        }),

        // Insegnanti attivi
        prisma.teacher.findMany({
          where: {
            tenantId: session.user.tenantId,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        }),

        // Materie
        prisma.subject.findMany({
          where: {
            tenantId: session.user.tenantId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            code: true,
          },
        }),

        // Assegnazioni materia-classe-insegnante con ore settimanali
        prisma.classSubject.findMany({
          where: {
            class: {
              tenantId: session.user.tenantId,
              isActive: true,
            },
          },
          select: {
            classId: true,
            subjectId: true,
            teacherId: true,
            weeklyHours: true,
          },
        }),

        // Configurazione slot orari
        prisma.timeSlotConfig.findMany({
          where: {
            tenantId: session.user.tenantId,
          },
          orderBy: {
            slotNumber: 'asc',
          },
        }),
      ]);

    // Se non ci sono time slot configurati, usa default
    const timeSlots: TimeSlot[] =
      timeSlotConfigs.length > 0
        ? timeSlotConfigs.map((ts: { slotNumber: number; startTime: string; endTime: string; isBreak: boolean }) => ({
            slotNumber: ts.slotNumber,
            startTime: ts.startTime,
            endTime: ts.endTime,
            isBreak: ts.isBreak,
          }))
        : [
            { slotNumber: 1, startTime: '08:00', endTime: '09:00', isBreak: false },
            { slotNumber: 2, startTime: '09:00', endTime: '10:00', isBreak: false },
            { slotNumber: 3, startTime: '10:00', endTime: '11:00', isBreak: false },
            { slotNumber: 4, startTime: '11:00', endTime: '12:00', isBreak: false },
            { slotNumber: 5, startTime: '12:00', endTime: '13:00', isBreak: false },
            { slotNumber: 6, startTime: '14:00', endTime: '15:00', isBreak: false },
          ];

    // Verifica dati minimi
    if (classes.length === 0) {
      return NextResponse.json(
        { error: 'Nessuna classe attiva trovata' },
        { status: 400 }
      );
    }

    if (teachers.length === 0) {
      return NextResponse.json(
        { error: 'Nessun insegnante attivo trovato' },
        { status: 400 }
      );
    }

    if (classSubjects.length === 0) {
      return NextResponse.json(
        {
          error:
            'Nessuna assegnazione materia-classe-insegnante trovata. Configura prima le materie per ogni classe.',
        },
        { status: 400 }
      );
    }

    // Prepara input per l'algoritmo
    const scheduleConfig = (schedule.config as unknown as ScheduleConfig) || DEFAULT_CONFIG;

    // Mappa difficoltà materie (per ora default, potrebbe essere configurabile)
    const subjectDifficulty: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {};
    const difficultSubjectNames = ['matematica', 'fisica', 'latino', 'greco', 'chimica'];
    const easySubjectNames = ['educazione fisica', 'arte', 'musica', 'religione'];

    for (const subject of subjects) {
      const nameLower = subject.name.toLowerCase();
      if (difficultSubjectNames.some((d: string) => nameLower.includes(d))) {
        subjectDifficulty[subject.id] = 'HIGH';
      } else if (easySubjectNames.some((e: string) => nameLower.includes(e))) {
        subjectDifficulty[subject.id] = 'LOW';
      } else {
        subjectDifficulty[subject.id] = 'MEDIUM';
      }
    }

    // Extract year from class name (e.g., "1A" -> year 1, section "A")
    const parseClassName = (name: string): { year: number; section: string } => {
      const match = name.match(/^(\d+)([A-Za-z]*)$/);
      if (match) {
        return { year: parseInt(match[1], 10), section: match[2] || '' };
      }
      return { year: 1, section: '' };
    };

    const input: ScheduleInput = {
      tenantId: session.user.tenantId,
      academicYearId: schedule.academicYearId,
      classes: classes.map((c: { id: string; name: string; code: string }) => {
        const { year, section } = parseClassName(c.name);
        return {
          id: c.id,
          name: c.name,
          year,
          section,
        };
      }),
      teachers: teachers.map((t: { id: string; firstName: string; lastName: string }) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
      })),
      subjects: subjects.map((s: { id: string; name: string }) => ({
        id: s.id,
        name: s.name,
        difficulty: subjectDifficulty[s.id],
      })),
      assignments: classSubjects
        .filter((cs: { teacherId: string | null; weeklyHours: number }) => cs.teacherId && cs.weeklyHours > 0)
        .map((cs: { classId: string; subjectId: string; teacherId: string | null; weeklyHours: number }) => ({
          classId: cs.classId,
          subjectId: cs.subjectId,
          teacherId: cs.teacherId!,
          weeklyHours: cs.weeklyHours,
        })),
      timeSlots,
      days: [1, 2, 3, 4, 5], // Lun-Ven
      config: scheduleConfig,
    };

    // Genera orario
    const result = await generateSchedule(input, scheduleConfig);

    // Salva risultato nel database
    if (result.success && result.slots.length > 0) {
      // Elimina slot precedenti
      await prisma.scheduleSlot.deleteMany({
        where: { scheduleId: id },
      });

      // Crea nuovi slot
      await prisma.scheduleSlot.createMany({
        data: result.slots.map(slot => ({
          scheduleId: id,
          dayOfWeek: slot.dayOfWeek,
          slotNumber: slot.slotNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          classId: slot.classId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          room: slot.room ?? null,
          score: slot.score ?? null,
          warnings: slot.warnings ? JSON.parse(JSON.stringify(slot.warnings)) : null,
        })),
      });

      // Aggiorna stato orario
      await prisma.schedule.update({
        where: { id },
        data: {
          status: 'GENERATED',
          generatedAt: new Date(),
          score: result.score,
          stats: JSON.parse(JSON.stringify(result.stats)),
        },
      });
    }

    return NextResponse.json({
      success: result.success,
      score: result.score,
      stats: result.stats,
      slotsGenerated: result.slots.length,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Error generating schedule:', error);
    return NextResponse.json(
      { error: 'Errore durante la generazione dell\'orario' },
      { status: 500 }
    );
  }
}
