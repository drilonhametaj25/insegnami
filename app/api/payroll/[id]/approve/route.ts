import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/[id]/approve — DRAFT → APPROVED.
 * Locks the cedolino: editing extras/withholdings post-approval is
 * disallowed via the PATCH route. The next step is mark-paid.
 *
 * Authorization: ADMIN/DIRECTOR per the RBAC matrix; SUPERADMIN bypasses.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({
      roles: ['ADMIN', 'DIRECTOR', 'SUPERADMIN'],
      permission: { action: 'update', resource: 'payroll' },
    });
    const { id } = await params;

    const existing = await prisma.payroll.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Stato ${existing.status}: solo i cedolini DRAFT possono essere approvati` },
        { status: 409 },
      );
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: ctx.userId,
        approvedAt: new Date(),
      },
    });
    return NextResponse.json({ payroll: updated });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
