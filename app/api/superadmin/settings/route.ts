import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Impostazioni piattaforma persistite sul singleton PlatformSettings
// (id 'platform'): trial predefinito, blocco registrazioni, manutenzione,
// mittente email e giorni di grazia dunning.

const PLATFORM_ID = 'platform';

const updateSettingsSchema = z.object({
  defaultTrialDays: z.number().int().min(0).max(90).optional(),
  allowNewRegistrations: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  senderName: z.string().max(100).nullable().optional(),
  senderEmail: z.string().email().nullable().optional(),
  replyTo: z.string().email().nullable().optional(),
  graceDays: z.number().int().min(0).max(60).optional(),
});

const DEFAULT_SETTINGS = {
  defaultTrialDays: 14,
  allowNewRegistrations: true,
  maintenanceMode: false,
  senderName: null as string | null,
  senderEmail: null as string | null,
  replyTo: null as string | null,
  graceDays: 7,
};

function serializeSettings(row: {
  defaultTrialDays: number;
  allowNewRegistrations: boolean;
  maintenanceMode: boolean;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  graceDays: number;
} | null) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    defaultTrialDays: row.defaultTrialDays,
    allowNewRegistrations: row.allowNewRegistrations,
    maintenanceMode: row.maintenanceMode,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    replyTo: row.replyTo,
    graceDays: row.graceDays,
  };
}

// GET /api/superadmin/settings - Impostazioni piattaforma + stat di contesto
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const [settingsRow, totalTenants, activeSubscriptions, plansCount] = await Promise.all([
      prisma.platformSettings.findUnique({ where: { id: PLATFORM_ID } }),
      prisma.tenant.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.plan.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      settings: serializeSettings(settingsRow),
      platformInfo: {
        totalTenants,
        activeSubscriptions,
        activePlans: plansCount,
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION || '1.0.0',
      },
    });
  } catch (error) {
    console.error('SuperAdmin settings GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PUT /api/superadmin/settings - Aggiorna il singleton (upsert)
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);

    const updated = await prisma.platformSettings.upsert({
      where: { id: PLATFORM_ID },
      create: { id: PLATFORM_ID, ...DEFAULT_SETTINGS, ...validatedData },
      update: validatedData,
    });

    // Log per audit
    console.log('SuperAdmin settings updated by:', session.user.email, validatedData);

    return NextResponse.json({
      message: 'Impostazioni aggiornate con successo',
      settings: serializeSettings(updated),
    });
  } catch (error) {
    console.error('SuperAdmin settings PUT error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
