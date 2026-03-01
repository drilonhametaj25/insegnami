import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { createStripeProduct } from '@/lib/stripe';

const createPlanSchema = z.object({
  name: z.string().min(2, 'Nome richiesto'),
  slug: z.string().min(2, 'Slug richiesto').regex(/^[a-z0-9-]+$/, 'Slug non valido'),
  description: z.string().optional(),
  price: z.number().min(0, 'Prezzo non valido'),
  interval: z.enum(['MONTHLY', 'YEARLY']),
  maxStudents: z.number().int().positive().nullable().optional(),
  maxTeachers: z.number().int().positive().nullable().optional(),
  maxClasses: z.number().int().positive().nullable().optional(),
  features: z.record(z.any()).optional().default({}),
  isPopular: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  syncToStripe: z.boolean().optional().default(true),
});

// GET /api/superadmin/plans - List all plans
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where = includeInactive ? {} : { isActive: true };

    const plans = await prisma.plan.findMany({
      where,
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Format plans with computed fields
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: parseFloat(plan.price.toString()),
      interval: plan.interval,
      stripePriceId: plan.stripePriceId,
      maxStudents: plan.maxStudents,
      maxTeachers: plan.maxTeachers,
      maxClasses: plan.maxClasses,
      features: plan.features,
      isPopular: plan.isPopular,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      activeSubscriptions: plan._count.subscriptions,
    }));

    return NextResponse.json({ plans: formattedPlans });
  } catch (error) {
    console.error('SuperAdmin plans GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// POST /api/superadmin/plans - Create new plan
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
    const validatedData = createPlanSchema.parse(body);

    // Check slug uniqueness
    const existingSlug = await prisma.plan.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug già in uso' }, { status: 400 });
    }

    let stripePriceId = '';

    // Create in Stripe if requested
    if (validatedData.syncToStripe) {
      try {
        const priceInCents = Math.round(validatedData.price * 100);
        const stripeInterval = validatedData.interval === 'MONTHLY' ? 'month' : 'year';

        const { price } = await createStripeProduct({
          name: validatedData.name,
          description: validatedData.description,
          priceAmount: priceInCents,
          interval: stripeInterval,
          metadata: {
            planSlug: validatedData.slug,
          },
        });

        stripePriceId = price.id;
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        return NextResponse.json({
          error: 'Errore nella creazione del piano in Stripe',
          details: stripeError instanceof Error ? stripeError.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Create plan in database
    const plan = await prisma.plan.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        price: validatedData.price,
        interval: validatedData.interval,
        stripePriceId: stripePriceId || `manual_${validatedData.slug}`,
        maxStudents: validatedData.maxStudents,
        maxTeachers: validatedData.maxTeachers,
        maxClasses: validatedData.maxClasses,
        features: validatedData.features,
        isPopular: validatedData.isPopular,
        sortOrder: validatedData.sortOrder,
        isActive: true,
      },
    });

    return NextResponse.json({
      message: 'Piano creato con successo',
      plan,
      stripeSync: validatedData.syncToStripe,
    }, { status: 201 });
  } catch (error) {
    console.error('SuperAdmin plans POST error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
