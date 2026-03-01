import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// System settings stored in a simple key-value table
// For now, we'll use a JSON file or environment-based approach
// In production, this could be stored in Redis or a dedicated settings table

const updateSettingsSchema = z.object({
  defaultTrialDays: z.number().int().min(0).max(90).optional(),
  maxTenantsPerPlan: z.record(z.number().int().positive()).optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
  allowNewRegistrations: z.boolean().optional(),
  defaultFeatureFlags: z.record(z.boolean()).optional(),
  emailSettings: z
    .object({
      fromName: z.string().optional(),
      fromEmail: z.string().email().optional(),
      replyTo: z.string().email().optional(),
    })
    .optional(),
  stripeSettings: z
    .object({
      webhookEnabled: z.boolean().optional(),
      testMode: z.boolean().optional(),
    })
    .optional(),
});

// Default settings
const defaultSettings = {
  defaultTrialDays: 14,
  maxTenantsPerPlan: {},
  maintenanceMode: false,
  maintenanceMessage: '',
  allowNewRegistrations: true,
  defaultFeatureFlags: {
    advancedReporting: false,
    apiAccess: false,
    customBranding: false,
    multiLanguage: true,
  },
  emailSettings: {
    fromName: 'InsegnaMi.pro',
    fromEmail: 'noreply@insegnami.pro',
    replyTo: 'support@insegnami.pro',
  },
  stripeSettings: {
    webhookEnabled: true,
    testMode: process.env.NODE_ENV !== 'production',
  },
};

// In-memory settings cache (in production, use Redis or DB)
let settingsCache: typeof defaultSettings = { ...defaultSettings };

// GET /api/superadmin/settings - Get system settings
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Get platform stats for context
    const [totalTenants, activeSubscriptions, plansCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.plan.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      settings: settingsCache,
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

// PUT /api/superadmin/settings - Update system settings
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

    // Merge with existing settings
    settingsCache = {
      ...settingsCache,
      ...validatedData,
      emailSettings: {
        ...settingsCache.emailSettings,
        ...validatedData.emailSettings,
      },
      stripeSettings: {
        ...settingsCache.stripeSettings,
        ...validatedData.stripeSettings,
      },
      defaultFeatureFlags: {
        ...settingsCache.defaultFeatureFlags,
        ...validatedData.defaultFeatureFlags,
      },
    };

    // Log settings change for audit
    console.log('SuperAdmin settings updated by:', session.user.email, validatedData);

    return NextResponse.json({
      message: 'Impostazioni aggiornate con successo',
      settings: settingsCache,
    });
  } catch (error) {
    console.error('SuperAdmin settings PUT error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// POST /api/superadmin/settings/reset - Reset to default settings
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'reset') {
      settingsCache = { ...defaultSettings };
      return NextResponse.json({
        message: 'Impostazioni resettate ai valori predefiniti',
        settings: settingsCache,
      });
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (error) {
    console.error('SuperAdmin settings POST error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
