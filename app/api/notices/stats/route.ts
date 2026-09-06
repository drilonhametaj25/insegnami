import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

/**
 * GET /api/notices/stats — contatori per la pagina avvisi.
 * Chiavi allineate a NoticeStats (lib/hooks/useNotices.ts): totalNotices,
 * publishedNotices, draftNotices, archivedNotices, urgentNotices,
 * noticesThisMonth (basate sul campo reale Notice.status).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can view notice stats
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalNotices,
      publishedNotices,
      draftNotices,
      archivedNotices,
      urgentNotices,
      noticesThisMonth,
    ] = await Promise.all([
      prisma.notice.count({ where: { tenantId } }),
      prisma.notice.count({ where: { tenantId, status: 'PUBLISHED' } }),
      prisma.notice.count({ where: { tenantId, status: 'DRAFT' } }),
      prisma.notice.count({ where: { tenantId, status: 'ARCHIVED' } }),
      prisma.notice.count({
        where: {
          tenantId,
          OR: [{ type: 'URGENT' }, { isUrgent: true }],
        },
      }),
      prisma.notice.count({
        where: { tenantId, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return NextResponse.json({
      totalNotices,
      publishedNotices,
      draftNotices,
      archivedNotices,
      urgentNotices,
      noticesThisMonth,
    });
  } catch (error) {
    console.error('Error fetching notice stats:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
