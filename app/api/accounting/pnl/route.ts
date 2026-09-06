import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { getPnL, getPnLTrend } from '@/lib/accounting/pnl';
import { endOfDay } from '@/lib/dates';

/**
 * GET /api/accounting/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD&trend=12
 *
 * Returns the P&L for the requested period plus an optional 12-month
 * trend series (when `trend` query param is set; capped to 24 months).
 *
 * Tenant scope is implicit — the helper reads from AccountingMovement
 * filtered by ctx.tenantId. SUPERADMIN can pass ?tenantId=... explicitly
 * to inspect another tenant's books for support purposes.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'accounting' }, feature: 'accounting' });
    const sp = request.nextUrl.searchParams;

    const tenantId =
      ctx.isSuperAdmin && sp.get('tenantId') ? sp.get('tenantId')! : ctx.tenantId;

    // endOfDay sul `to` esplicito: una data nuda "YYYY-MM-DD" è mezzanotte
    // e lascerebbe fuori i movimenti dell'ultimo giorno del range.
    const from = sp.get('from') ? new Date(sp.get('from')!) : startOfMonth(new Date());
    const to = sp.get('to') ? endOfDay(new Date(sp.get('to')!)) : endOfMonth(new Date());

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Date non valide' }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: 'Range invalido: from > to' }, { status: 400 });
    }

    const report = await getPnL(tenantId, { start: from, end: to });

    let trend: ReturnType<typeof getPnLTrend> extends Promise<infer R> ? R : never | null = null as any;
    const trendParam = sp.get('trend');
    if (trendParam) {
      const months = Math.min(Math.max(parseInt(trendParam, 10) || 12, 1), 24);
      const ref = to;
      trend = await getPnLTrend(tenantId, ref.getUTCFullYear(), ref.getUTCMonth() + 1, months);
    }

    return NextResponse.json({ report, trend });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('pnl GET error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}
