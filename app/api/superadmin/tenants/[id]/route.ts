import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  domain: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  trialUntil: z.string().nullable().optional(),
  featureFlags: z.record(z.boolean()).optional(),
});

// GET /api/superadmin/tenants/[id] - Get tenant details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                lastLogin: true,
              },
            },
          },
          take: 50,
        },
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            classes: true,
            courses: true,
            lessons: true,
            payments: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    // Get revenue stats for this tenant
    const revenueStats = await prisma.payment.aggregate({
      where: {
        tenantId: id,
        status: 'PAID',
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Get recent activity
    const recentPayments = await prisma.payment.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        status: true,
        description: true,
        createdAt: true,
      },
    });

    // Calculate trial info
    const isTrialing = tenant.trialUntil && new Date(tenant.trialUntil) > new Date() && !tenant.subscription;
    const trialDaysLeft = tenant.trialUntil
      ? Math.ceil((new Date(tenant.trialUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        plan: tenant.plan,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        setupStage: tenant.setupStage,
        setupCompletedAt: tenant.setupCompletedAt,
        stripeCustomerId: tenant.stripeCustomerId,
        featureFlags: tenant.featureFlags,

        // Trial info
        trialUntil: tenant.trialUntil,
        isTrialing,
        trialDaysLeft: isTrialing ? Math.max(0, trialDaysLeft) : 0,

        // Subscription
        subscription: tenant.subscription,

        // Users list
        users: tenant.users.map((ut) => ({
          ...ut.user,
          role: ut.role,
          joinedAt: ut.createdAt,
        })),

        // Usage stats
        usage: tenant._count,

        // Revenue
        revenue: {
          total: revenueStats._sum.amount || 0,
          paymentsCount: revenueStats._count.id,
        },

        // Recent activity
        recentPayments,
      },
    });
  } catch (error) {
    console.error('SuperAdmin tenant GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PUT /api/superadmin/tenants/[id] - Update tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTenantSchema.parse(body);

    // Check tenant exists
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    // Check slug uniqueness if changing
    if (validatedData.slug && validatedData.slug !== existing.slug) {
      const slugExists = await prisma.tenant.findUnique({
        where: { slug: validatedData.slug },
      });
      if (slugExists) {
        return NextResponse.json({ error: 'Slug già in uso' }, { status: 400 });
      }
    }

    // Check domain uniqueness if changing
    if (validatedData.domain && validatedData.domain !== existing.domain) {
      const domainExists = await prisma.tenant.findUnique({
        where: { domain: validatedData.domain },
      });
      if (domainExists) {
        return NextResponse.json({ error: 'Dominio già in uso' }, { status: 400 });
      }
    }

    // Build update data
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.slug !== undefined) updateData.slug = validatedData.slug;
    if (validatedData.domain !== undefined) updateData.domain = validatedData.domain;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.trialUntil !== undefined) {
      updateData.trialUntil = validatedData.trialUntil ? new Date(validatedData.trialUntil) : null;
    }
    if (validatedData.featureFlags !== undefined) updateData.featureFlags = validatedData.featureFlags;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Tenant aggiornato con successo',
      tenant,
    });
  } catch (error) {
    console.error('SuperAdmin tenant PUT error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/superadmin/tenants/[id] - Delete tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Check tenant exists
    const existing = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: true,
        _count: {
          select: {
            users: true,
            students: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    // Warn if tenant has active subscription
    if (existing.subscription && existing.subscription.status === 'ACTIVE') {
      return NextResponse.json({
        error: 'Non è possibile eliminare un tenant con abbonamento attivo. Cancella prima l\'abbonamento.',
      }, { status: 400 });
    }

    // Warn if tenant has data
    if (existing._count.users > 0 || existing._count.students > 0) {
      const { searchParams } = new URL(request.url);
      const forceDelete = searchParams.get('force') === 'true';

      if (!forceDelete) {
        return NextResponse.json({
          error: 'Tenant contiene dati. Usa ?force=true per confermare l\'eliminazione.',
          data: {
            users: existing._count.users,
            students: existing._count.students,
          },
        }, { status: 400 });
      }
    }

    // Delete tenant (cascades will handle related records)
    await prisma.tenant.delete({ where: { id } });

    return NextResponse.json({
      message: 'Tenant eliminato con successo',
    });
  } catch (error) {
    console.error('SuperAdmin tenant DELETE error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PATCH /api/superadmin/tenants/[id] - Special actions (extend trial, suspend, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, value } = body;

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    let updateData: any = {};
    let message = '';

    switch (action) {
      case 'extend_trial':
        // Extend trial by X days
        const days = parseInt(value) || 14;
        const currentTrial = existing.trialUntil || new Date();
        const newTrialEnd = new Date(Math.max(currentTrial.getTime(), Date.now()));
        newTrialEnd.setDate(newTrialEnd.getDate() + days);
        updateData.trialUntil = newTrialEnd;
        message = `Trial esteso di ${days} giorni fino al ${newTrialEnd.toLocaleDateString('it-IT')}`;
        break;

      case 'suspend':
        updateData.isActive = false;
        message = 'Tenant sospeso';
        break;

      case 'activate':
        updateData.isActive = true;
        message = 'Tenant riattivato';
        break;

      case 'reset_setup':
        updateData.setupStage = 'INITIAL';
        updateData.setupCompletedAt = null;
        message = 'Setup resettato';
        break;

      default:
        return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ message, tenant });
  } catch (error) {
    console.error('SuperAdmin tenant PATCH error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
