import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { deactivatePrice, getStripePrice } from '@/lib/stripe';
import { yearlyPriceOf } from '@/lib/billing/plans-catalog';

// Il catalogo piani (nome, prezzo, limiti, features) è definito nel codice
// (lib/billing/plans-catalog.ts) e sincronizzato da seed/sync Stripe: via API
// sono modificabili SOLO i campi di presentazione.
const updatePlanSchema = z.object({
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// Campi di catalogo il cui aggiornamento via API è esplicitamente rifiutato.
const CATALOG_ONLY_FIELDS = [
  'name',
  'slug',
  'description',
  'price',
  'interval',
  'maxStudents',
  'maxTeachers',
  'maxClasses',
  'features',
  'isActive',
  'stripePriceId',
  'syncToStripe',
] as const;

// GET /api/superadmin/plans/[id] - Get plan details
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

    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          take: 50,
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Piano non trovato' }, { status: 404 });
    }

    // Get Stripe price info if available
    let stripeInfo = null;
    if (plan.stripePriceId && !plan.stripePriceId.startsWith('manual_')) {
      try {
        const stripePrice = await getStripePrice(plan.stripePriceId);
        stripeInfo = {
          priceId: stripePrice.id,
          productId: typeof stripePrice.product === 'string'
            ? stripePrice.product
            : stripePrice.product?.id,
          active: stripePrice.active,
          unitAmount: stripePrice.unit_amount,
        };
      } catch {
        // Stripe price might not exist
      }
    }

    // Calculate revenue from this plan, split per intervallo di fatturazione
    // della SUBSCRIPTION: le annuali contribuiscono al ricavo mensile con il
    // prezzo annuale (12 mesi al prezzo di 10) spalmato su 12 mesi.
    const activeByInterval = await prisma.subscription.groupBy({
      by: ['interval'],
      where: {
        planId: id,
        status: 'ACTIVE',
      },
      _count: { id: true },
    });

    const planPrice = parseFloat(plan.price.toString());
    const monthlyCount =
      activeByInterval.find((g) => g.interval === 'MONTHLY')?._count.id ?? 0;
    const yearlyCount =
      activeByInterval.find((g) => g.interval === 'YEARLY')?._count.id ?? 0;
    const activeCount = monthlyCount + yearlyCount;

    const monthlyRevenue =
      plan.interval === 'YEARLY'
        ? (planPrice / 12) * activeCount
        : monthlyCount * planPrice + yearlyCount * (yearlyPriceOf(planPrice) / 12);

    return NextResponse.json({
      plan: {
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

        // Computed fields
        totalSubscriptions: plan._count.subscriptions,
        activeSubscriptions: activeCount,
        monthlyRevenue,
        annualRevenue: monthlyRevenue * 12,

        // Stripe info
        stripeInfo,

        // Recent subscribers
        recentSubscribers: plan.subscriptions.map((sub) => ({
          id: sub.id,
          tenant: sub.tenant,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          createdAt: sub.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('SuperAdmin plan GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PUT /api/superadmin/plans/[id] - Update plan
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

    // Catalogo read-only: qualsiasi tentativo di modificare campi di catalogo
    // via API viene rifiutato con 405 (la fonte di verità è il codice).
    const rejectedFields = CATALOG_ONLY_FIELDS.filter((field) => field in body);
    if (rejectedFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Il catalogo piani è definito nel codice (lib/billing/plans-catalog.ts)',
          rejectedFields,
        },
        { status: 405 }
      );
    }

    const validatedData = updatePlanSchema.parse(body);

    // Check plan exists
    const existing = await prisma.plan.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Piano non trovato' }, { status: 404 });
    }

    // Solo campi di presentazione
    const updateData: { isPopular?: boolean; sortOrder?: number } = {};
    if (validatedData.isPopular !== undefined) updateData.isPopular = validatedData.isPopular;
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo aggiornabile fornito (ammessi: isPopular, sortOrder)' },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Piano aggiornato con successo',
      plan,
    });
  } catch (error) {
    console.error('SuperAdmin plan PUT error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/superadmin/plans/[id] - Deactivate plan (soft delete)
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

    // Check plan exists and has no active subscriptions
    const existing = await prisma.plan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Piano non trovato' }, { status: 404 });
    }

    if (existing.subscriptions.length > 0) {
      return NextResponse.json({
        error: 'Non è possibile eliminare un piano con abbonamenti attivi',
        activeSubscriptions: existing.subscriptions.length,
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete (only if no subscriptions at all)
      const allSubs = await prisma.subscription.count({ where: { planId: id } });
      if (allSubs > 0) {
        return NextResponse.json({
          error: 'Non è possibile eliminare definitivamente un piano con storico abbonamenti',
        }, { status: 400 });
      }

      await prisma.plan.delete({ where: { id } });

      // Deactivate Stripe price
      if (!existing.stripePriceId.startsWith('manual_')) {
        try {
          await deactivatePrice(existing.stripePriceId);
        } catch {
          // Price might not exist
        }
      }

      return NextResponse.json({ message: 'Piano eliminato definitivamente' });
    }

    // Soft delete (deactivate)
    const plan = await prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });

    // Deactivate Stripe price
    if (!existing.stripePriceId.startsWith('manual_')) {
      try {
        await deactivatePrice(existing.stripePriceId);
      } catch {
        // Price might not exist
      }
    }

    return NextResponse.json({
      message: 'Piano disattivato con successo',
      plan,
    });
  } catch (error) {
    console.error('SuperAdmin plan DELETE error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
