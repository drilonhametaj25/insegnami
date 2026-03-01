import { NextRequest, NextResponse } from 'next/server';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const SETUP_STAGES = ['INITIAL', 'SCHOOL', 'TEAM', 'TEACHERS', 'CLASSES', 'COMPLETE'] as const;

const updateStageSchema = z.object({
  stage: z.enum(SETUP_STAGES),
});

const updateSchoolSchema = z.object({
  name: z.string().min(2, 'Nome scuola richiesto'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().url().optional(),
});

// GET /api/onboarding - Get current onboarding status
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        setupStage: true,
        setupCompletedAt: true,
        _count: {
          select: {
            teachers: true,
            classes: true,
            students: true,
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    return NextResponse.json({
      tenant,
      stats: tenant._count,
      isComplete: tenant.setupStage === 'COMPLETE',
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero stato onboarding' },
      { status: 500 }
    );
  }
}

// PUT /api/onboarding - Update onboarding stage or school info
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const body = await request.json();

    // Check if this is a stage update or school info update
    if (body.stage) {
      const { stage } = updateStageSchema.parse(body);

      const updateData: any = { setupStage: stage };
      if (stage === 'COMPLETE') {
        updateData.setupCompletedAt = new Date();
      }

      const tenant = await prisma.tenant.update({
        where: { id: session.user.tenantId },
        data: updateData,
        select: {
          id: true,
          name: true,
          setupStage: true,
          setupCompletedAt: true,
        },
      });

      return NextResponse.json({ tenant });
    }

    // Update school info
    const schoolData = updateSchoolSchema.parse(body);

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        name: schoolData.name,
        // Note: address, phone, email, logo fields would need to be added to Tenant model
        // For now, we just update the name
      },
      select: {
        id: true,
        name: true,
        setupStage: true,
      },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Update onboarding error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento onboarding' },
      { status: 500 }
    );
  }
}

// POST /api/onboarding/skip - Skip onboarding
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        setupStage: 'COMPLETE',
        setupCompletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Onboarding completato',
      tenant: {
        id: tenant.id,
        setupStage: tenant.setupStage,
      },
    });
  } catch (error) {
    console.error('Skip onboarding error:', error);
    return NextResponse.json(
      { error: 'Errore nel completamento onboarding' },
      { status: 500 }
    );
  }
}
