import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/periods/[id]/lock
 *
 * Closes the period: status OPEN → LOCKED. Once locked, generated
 * Payroll rows can still be approved/marked-paid, but new generation
 * runs are refused. Lessons added after the lock can't retroactively
 * change already-issued cedolini — the snapshot stays anchored.
 *
 * Reversible by SUPERADMIN-only via direct DB update; the API only
 * allows lock-forward.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'payroll' } });
    const { id } = await params;

    const existing = await prisma.payrollPeriod.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Periodo non trovato' }, { status: 404 });
    if (existing.status !== 'OPEN') {
      return NextResponse.json(
        { error: `Stato attuale: ${existing.status}. Solo periodi OPEN possono essere chiusi.` },
        { status: 409 },
      );
    }

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedBy: ctx.userId },
    });
    return NextResponse.json({ period: updated });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
