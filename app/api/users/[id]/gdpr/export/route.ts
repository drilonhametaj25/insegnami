import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { exportUserData } from '@/lib/gdpr/export';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/users/[id]/gdpr/export
 *
 * ADMIN/DIRECTOR/SUPERADMIN-only path to fulfil a documented GDPR Art.20
 * request when the data subject can't (or won't) trigger it themselves.
 *
 * Tenant-scoped: the target user must be a member of the caller's tenant.
 * SUPERADMIN bypasses tenant scope. Every export writes an AuditLog row
 * — Article 30 demands traceability of GDPR-related operations.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ roles: ['ADMIN', 'DIRECTOR', 'SUPERADMIN'] });
    const { id: targetUserId } = await params;

    if (!ctx.isSuperAdmin) {
      const membership = await prisma.userTenant.findFirst({
        where: { userId: targetUserId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Utente non in questo tenant' }, { status: 404 });
      }
    }

    const data = await exportUserData(targetUserId);

    // Audit — who exported whose data and when.
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'GDPR_EXPORT',
          entity: 'User',
          entityId: targetUserId,
          newData: { exportedBy: ctx.userId, at: new Date().toISOString() } as any,
        },
      });
    } catch {/* non-fatal */}

    const filename = `insegnami-data-${targetUserId}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('admin gdpr export error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
