import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  createNewPrice,
  deactivatePrice,
  getStripePrice,
  updateStripeProduct
} from '@/lib/stripe';

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  maxStudents: z.number().int().positive().nullable().optional(),
  maxTeachers: z.number().int().positive().nullable().optional(),
  maxClasses: z.number().int().positive().nullable().optional(),
  features: z.record(z.any()).optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  syncToStripe: z.boolean().optional().default(true),
});

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

    // Calculate revenue from this plan
    const revenueStats = await prisma.subscription.aggregate({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
      _count: { id: true },
    });

    const monthlyRevenue = parseFloat(plan.price.toString()) * revenueStats._count.id;

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
        activeSubscriptions: revenueStats._count.id,
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
    const validatedData = updatePlanSchema.parse(body);

    // Check plan exists
    const existing = await prisma.plan.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Piano non trovato' }, { status: 404 });
    }

    // Handle Stripe sync
    let newStripePriceId = existing.stripePriceId;
    const priceChanged = validatedData.price !== undefined &&
      validatedData.price !== parseFloat(existing.price.toString());

    if (validatedData.syncToStripe && !existing.stripePriceId.startsWith('manual_')) {
      try {
        // If price changed, create new price and deactivate old one
        if (priceChanged) {
          const stripePrice = await getStripePrice(existing.stripePriceId);
          const productId = typeof stripePrice.product === 'string'
            ? stripePrice.product
            : stripePrice.product?.id;

          if (productId) {
            // Create new price
            const newPrice = await createNewPrice({
              productId,
              priceAmount: Math.round(validatedData.price! * 100),
              interval: existing.interval === 'MONTHLY' ? 'month' : 'year',
              metadata: { planSlug: existing.slug },
            });

            newStripePriceId = newPrice.id;

            // Deactivate old price (but don't delete - there might be active subscriptions)
            await deactivatePrice(existing.stripePriceId);
          }
        }

        // Update product name/description if changed
        if (validatedData.name || validatedData.description !== undefined) {
          const stripePrice = await getStripePrice(existing.stripePriceId);
          const productId = typeof stripePrice.product === 'string'
            ? stripePrice.product
            : stripePrice.product?.id;

          if (productId) {
            await updateStripeProduct({
              productId,
              name: validatedData.name,
              description: validatedData.description || undefined,
            });
          }
        }
      } catch (stripeError) {
        console.error('Stripe sync error:', stripeError);
        // Don't fail the update, just log the error
      }
    }

    // Build update data
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.price !== undefined) updateData.price = validatedData.price;
    if (validatedData.maxStudents !== undefined) updateData.maxStudents = validatedData.maxStudents;
    if (validatedData.maxTeachers !== undefined) updateData.maxTeachers = validatedData.maxTeachers;
    if (validatedData.maxClasses !== undefined) updateData.maxClasses = validatedData.maxClasses;
    if (validatedData.features !== undefined) updateData.features = validatedData.features;
    if (validatedData.isPopular !== undefined) updateData.isPopular = validatedData.isPopular;
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (newStripePriceId !== existing.stripePriceId) {
      updateData.stripePriceId = newStripePriceId;
    }

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Piano aggiornato con successo',
      plan,
      stripePriceChanged: priceChanged,
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
