import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createTenantSchema = z.object({
  name: z.string().min(2, 'Nome richiesto'),
  slug: z.string().min(2, 'Slug richiesto').regex(/^[a-z0-9-]+$/, 'Slug non valido'),
  domain: z.string().optional(),
  plan: z.string().optional().default('basic'),
  trialUntil: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

// GET /api/superadmin/tenants - List all tenants (SUPERADMIN only)
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only SUPERADMIN can access this endpoint
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status'); // active, inactive, trialing, all
    const planFilter = searchParams.get('plan');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'active') {
      where.isActive = true;
      where.OR = [
        { subscription: { status: 'ACTIVE' } },
        { trialUntil: { gte: new Date() } },
      ];
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'trialing') {
      where.trialUntil = { gte: new Date() };
      where.subscription = null;
    }

    if (planFilter) {
      where.subscription = { plan: { slug: planFilter } };
    }

    // Get tenants with subscription and usage stats
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
              classes: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.tenant.count({ where }),
    ]);

    // Format response with computed fields
    const formattedTenants = tenants.map((tenant) => {
      const isTrialing = tenant.trialUntil && new Date(tenant.trialUntil) > new Date() && !tenant.subscription;
      const trialDaysLeft = tenant.trialUntil
        ? Math.ceil((new Date(tenant.trialUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        setupStage: tenant.setupStage,
        setupCompletedAt: tenant.setupCompletedAt,
        stripeCustomerId: tenant.stripeCustomerId,

        // Trial info
        trialUntil: tenant.trialUntil,
        isTrialing,
        trialDaysLeft: isTrialing ? trialDaysLeft : 0,

        // Subscription info
        subscription: tenant.subscription
          ? {
              id: tenant.subscription.id,
              status: tenant.subscription.status,
              plan: tenant.subscription.plan,
              currentPeriodEnd: tenant.subscription.currentPeriodEnd,
              cancelAtPeriodEnd: tenant.subscription.cancelAtPeriodEnd,
            }
          : null,

        // Usage stats
        usage: {
          users: tenant._count.users,
          students: tenant._count.students,
          teachers: tenant._count.teachers,
          classes: tenant._count.classes,
        },
      };
    });

    return NextResponse.json({
      tenants: formattedTenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('SuperAdmin tenants GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// POST /api/superadmin/tenants - Create new tenant
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createTenantSchema.parse(body);

    // Check slug uniqueness
    const existingSlug = await prisma.tenant.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug già in uso' }, { status: 400 });
    }

    // Check domain uniqueness if provided
    if (validatedData.domain) {
      const existingDomain = await prisma.tenant.findUnique({
        where: { domain: validatedData.domain },
      });

      if (existingDomain) {
        return NextResponse.json({ error: 'Dominio già in uso' }, { status: 400 });
      }
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        domain: validatedData.domain || null,
        plan: validatedData.plan,
        trialUntil: validatedData.trialUntil ? new Date(validatedData.trialUntil) : null,
        isActive: validatedData.isActive,
      },
    });

    return NextResponse.json({
      message: 'Tenant creato con successo',
      tenant,
    }, { status: 201 });
  } catch (error) {
    console.error('SuperAdmin tenants POST error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
