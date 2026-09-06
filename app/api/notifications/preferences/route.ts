import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

// Preferenze notifiche per-utente (NotificationPreferences, unique su userId).
// Qualsiasi utente autenticato gestisce SOLO le proprie preferenze.

const HHMM_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

const preferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
  emailImmediate: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  pushSound: z.boolean().optional(),
  // Mappa tipo → abilitato (es. { PAYMENT: false })
  typePreferences: z.record(z.string(), z.boolean()).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(HHMM_REGEX, 'Formato orario HH:MM').nullable().optional(),
  quietHoursEnd: z.string().regex(HHMM_REGEX, 'Formato orario HH:MM').nullable().optional(),
  digestFrequency: z.enum(['daily', 'weekly', 'never']).optional(),
  digestTime: z.string().regex(HHMM_REGEX, 'Formato orario HH:MM').optional(),
});

// Default coerenti con lo schema Prisma: usati quando la riga non esiste
const DEFAULT_PREFERENCES = {
  emailEnabled: true,
  emailDigest: true,
  emailImmediate: false,
  pushEnabled: true,
  pushSound: true,
  typePreferences: {} as Record<string, boolean>,
  quietHoursEnabled: false,
  quietHoursStart: null as string | null,
  quietHoursEnd: null as string | null,
  digestFrequency: 'daily',
  digestTime: '09:00',
};

export async function GET(_request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      data: prefs ?? { ...DEFAULT_PREFERENCES, userId: session.user.id },
      meta: { persisted: !!prefs },
    });
  } catch (error) {
    console.error('Errore nel recupero preferenze notifiche:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const body = await request.json();
    const validated = preferencesSchema.parse(body);

    // Coerenza quiet hours: se abilitate servono entrambi gli orari
    if (validated.quietHoursEnabled === true) {
      if (!validated.quietHoursStart || !validated.quietHoursEnd) {
        return NextResponse.json(
          { error: 'Con le ore di silenzio attive servono orario di inizio e fine' },
          { status: 400 }
        );
      }
    }

    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...validated,
        typePreferences: validated.typePreferences ?? {},
      },
      update: { ...validated },
    });

    return NextResponse.json({ data: prefs, meta: { persisted: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Errore nel salvataggio preferenze notifiche:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
