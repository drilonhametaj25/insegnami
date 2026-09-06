import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { generatePayrollForPeriod } from '@/lib/payroll/payroll-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/periods/[id]/generate
 *
 * Triggers DRAFT generation for every active teacher in the period.
 * Idempotent: existing payrolls in the period are left untouched.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'payroll' }, feature: 'payroll' });
    const { id } = await params;

    const period = await prisma.payrollPeriod.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!period) return NextResponse.json({ error: 'Periodo non trovato' }, { status: 404 });

    const result = await generatePayrollForPeriod(period.id);
    return NextResponse.json(result);
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    const message = err instanceof Error ? err.message : 'Errore interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
