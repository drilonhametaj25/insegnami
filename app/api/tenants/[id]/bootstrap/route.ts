import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { bootstrapTenant } from '@/lib/tenant-bootstrap';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tenants/[id]/bootstrap
 *
 * Idempotent re-seed of the tenant baseline (AcademicYear, periods,
 * holidays, default InvoiceSeries, InvoiceSettings placeholder).
 *
 * Use cases:
 *   - tenant created before this feature existed → admin clicks "Ripara
 *     dati di base" in /dashboard/admin/settings
 *   - register flow's bootstrap silently failed (network, transient DB) →
 *     admin reruns it from the dashboard
 *   - SUPERADMIN cleaning up a customer's environment
 *
 * Authorization: ADMIN+ within the tenant, or any SUPERADMIN cross-tenant.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth();
    const { id: tenantId } = await params;

    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['ADMIN', 'DIRECTOR', 'SUPERADMIN'].includes(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await bootstrapTenant(tenantId);
    return NextResponse.json({
      tenantId,
      ...report,
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('tenant bootstrap error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
