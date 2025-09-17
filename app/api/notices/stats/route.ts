import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can view notice stats
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    // Get basic counts
    const [
      totalNotices,
      activeNotices,
      pinnedNotices,
      scheduledNotices,
      urgentNotices,
      expiredNotices,
    ] = await Promise.all([
      prisma.notice.count({
        where: { tenantId },
      }),
      prisma.notice.count({
        where: {
          tenantId,
          publishAt: { lte: new Date() },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      }),
      prisma.notice.count({
        where: { tenantId, isPinned: true },
      }),
      prisma.notice.count({
        where: {
          tenantId,
          publishAt: { gt: new Date() },
        },
      }),
      prisma.notice.count({
        where: {
          tenantId,
          OR: [
            { type: 'URGENT' },
            { isUrgent: true },
          ],
        },
      }),
      prisma.notice.count({
        where: {
          tenantId,
          expiresAt: { lt: new Date() },
        },
      }),
    ]);

    // Get notices by type
    const noticesByType = await prisma.notice.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: { id: true },
    });

    // Get notices by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const noticesByMonth = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "publishAt") as month,
        COUNT(*) as count
      FROM "Notice" 
      WHERE "tenantId" = ${tenantId}
        AND "publishAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "publishAt")
      ORDER BY month ASC
    ` as Array<{ month: Date; count: bigint }>;

    // Calculate engagement rate (placeholder calculation)
    const totalUsers = await prisma.user.count({
      where: { 
        tenants: {
          some: {
            tenantId: tenantId,
          }
        }
      },
    });

    const engagementRate = totalUsers > 0 
      ? Math.round((activeNotices / totalUsers) * 100) 
      : 0;

    // Recent activity
    const recentNotices = await prisma.notice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
        isPinned: true,
        isUrgent: true,
      },
    });

    const stats = {
      total: totalNotices,
      active: activeNotices,
      pinned: pinnedNotices,
      scheduled: scheduledNotices,
      urgent: urgentNotices,
      expired: expiredNotices,
      totalViews: 0, // Placeholder - implement when view tracking is added
      totalReactions: 0, // Placeholder - implement when reaction system is added
      engagementRate,
      byType: noticesByType.map(item => ({
        type: item.type,
        count: item._count.id,
      })),
      byMonth: noticesByMonth.map(item => ({
        month: item.month.toISOString().substring(0, 7), // YYYY-MM format
        count: Number(item.count),
      })),
      recent: recentNotices,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching notice stats:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
