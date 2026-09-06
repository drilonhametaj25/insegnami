import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

// GET /api/courses/stats - Get courses statistics
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'course' } });

    // Build where clause with tenant scoping
    const where: any = tenantScope(ctx);

    // Get statistics
    const [
      totalCourses,
      activeCourses,
      inactiveCourses,
      coursesWithClasses,
      avgPriceResult,
    ] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.count({ where: { ...where, isActive: true } }),
      prisma.course.count({ where: { ...where, isActive: false } }),
      prisma.course.findMany({
        where,
        include: {
          _count: {
            select: {
              classes: true,
            },
          },
        },
      }),
      prisma.course.aggregate({
        where: { ...where, price: { not: null } },
        _avg: {
          price: true,
        },
      }),
    ]);

    const totalClasses = coursesWithClasses.reduce(
      (sum, course) => sum + course._count.classes,
      0
    );

    const averagePrice = Number(avgPriceResult._avg.price || 0);

    return NextResponse.json({
      total: totalCourses,
      active: activeCourses,
      inactive: inactiveCourses,
      totalClasses,
      averagePrice: Math.round(averagePrice * 100) / 100,
    });

  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Course stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
