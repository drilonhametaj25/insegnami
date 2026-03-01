import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/subscriptions/plans - Get all available plans
export async function GET(request: NextRequest) {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        stripePriceId: true,
        price: true,
        interval: true,
        maxStudents: true,
        maxTeachers: true,
        maxClasses: true,
        features: true,
        description: true,
        isPopular: true,
      },
    });

    // Transform Decimal to number for JSON serialization
    const transformedPlans = plans.map(plan => ({
      ...plan,
      price: Number(plan.price),
    }));

    return NextResponse.json({ plans: transformedPlans });
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero piani' },
      { status: 500 }
    );
  }
}
