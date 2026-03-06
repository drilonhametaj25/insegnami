import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema per configurazione slot orari
const timeSlotSchema = z.object({
  slotNumber: z.number().int().min(1).max(12),
  name: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato orario non valido (HH:MM)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato orario non valido (HH:MM)'),
  isBreak: z.boolean().default(false),
});

const timeSlotsArraySchema = z.array(timeSlotSchema);

// GET: Recupera configurazione slot orari
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const timeSlots = await prisma.timeSlotConfig.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      orderBy: {
        slotNumber: 'asc',
      },
    });

    // Se nessuna configurazione, restituisci default
    if (timeSlots.length === 0) {
      return NextResponse.json({
        timeSlots: [
          { slotNumber: 1, name: '1ª ora', startTime: '08:00', endTime: '09:00', isBreak: false },
          { slotNumber: 2, name: '2ª ora', startTime: '09:00', endTime: '10:00', isBreak: false },
          { slotNumber: 3, name: '3ª ora', startTime: '10:00', endTime: '11:00', isBreak: false },
          { slotNumber: 4, name: 'Intervallo', startTime: '11:00', endTime: '11:15', isBreak: true },
          { slotNumber: 5, name: '4ª ora', startTime: '11:15', endTime: '12:15', isBreak: false },
          { slotNumber: 6, name: '5ª ora', startTime: '12:15', endTime: '13:15', isBreak: false },
        ],
        isDefault: true,
      });
    }

    return NextResponse.json({ timeSlots, isDefault: false });
  } catch (error) {
    console.error('Error fetching time slots:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT: Salva/aggiorna configurazione slot orari
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!['ADMIN', 'DIRECTOR', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const timeSlots = timeSlotsArraySchema.parse(body.timeSlots);

    // Verifica sovrapposizioni orari
    const sortedSlots = [...timeSlots].sort((a, b) => a.slotNumber - b.slotNumber);
    for (let i = 1; i < sortedSlots.length; i++) {
      const prev = sortedSlots[i - 1];
      const curr = sortedSlots[i];

      if (prev.endTime > curr.startTime) {
        return NextResponse.json(
          {
            error: `Sovrapposizione orari tra slot ${prev.slotNumber} e ${curr.slotNumber}`,
          },
          { status: 400 }
        );
      }
    }

    // Verifica che ogni slot abbia startTime < endTime
    for (const slot of timeSlots) {
      if (slot.startTime >= slot.endTime) {
        return NextResponse.json(
          {
            error: `Slot ${slot.slotNumber}: l'ora di inizio deve essere precedente all'ora di fine`,
          },
          { status: 400 }
        );
      }
    }

    // Elimina configurazione esistente
    await prisma.timeSlotConfig.deleteMany({
      where: {
        tenantId: session.user.tenantId,
      },
    });

    // Crea nuova configurazione
    await prisma.timeSlotConfig.createMany({
      data: timeSlots.map(slot => ({
        tenantId: session.user.tenantId,
        slotNumber: slot.slotNumber,
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: slot.isBreak,
      })),
    });

    // Recupera e restituisci la configurazione aggiornata
    const updatedSlots = await prisma.timeSlotConfig.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      orderBy: {
        slotNumber: 'asc',
      },
    });

    return NextResponse.json({ timeSlots: updatedSlots });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error saving time slots:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
