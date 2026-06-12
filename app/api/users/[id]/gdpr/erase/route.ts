import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, authError } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { eraseUser } from '@/lib/gdpr/erase';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  reason: z.string().min(10, 'Indica la motivazione documentata della richiesta').max(1000),
  ticketReference: z.string().max(200).optional(),
});

/**
 * POST /api/users/[id]/gdpr/erase
 *
 * Admin path for fulfilling a documented Art.17 erasure request. Requires
 * a `reason` (≥10 chars) so the AuditLog row carries proper documentation —
 * the regulator will ask "why did you delete this user?" during an audit.
 *
 * Self-erasure should still go through DELETE /api/auth/me — that route
 * doesn't require this body shape. This admin path is for cases where
 * the subject contacted support in writing.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // GDPR: il diritto all'oblio non decade con l'abbonamento scaduto
    const ctx = await requireAuth({ roles: ['ADMIN', 'DIRECTOR', 'SUPERADMIN'], skipTenantAccessCheck: true });
    const { id: targetUserId } = await params;

    if (targetUserId === ctx.userId) {
      return NextResponse.json(
        { error: "Per cancellare il proprio account usa DELETE /api/auth/me" },
        { status: 400 },
      );
    }

    if (!ctx.isSuperAdmin) {
      const membership = await prisma.userTenant.findFirst({
        where: { userId: targetUserId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Utente non in questo tenant' }, { status: 404 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await eraseUser(targetUserId, {
      triggeredBy: ctx.userId,
      reason: parsed.data.ticketReference
        ? `${parsed.data.reason} (ref: ${parsed.data.ticketReference})`
        : parsed.data.reason,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    const message = err instanceof Error ? err.message : 'Errore interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
