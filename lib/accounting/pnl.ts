import { prisma } from '@/lib/db';

/**
 * P&L (Profit & Loss) service.
 *
 * Source of truth: AccountingMovement rows. All revenue and cost events
 * land there (Payment.PAID → REVENUE, Payroll.PAID → COST, manual entries
 * via /api/accounting/movements). Reading from movements means the
 * dashboard reflects exactly what's been posted, not a derived projection.
 *
 * Period handling: caller supplies inclusive [start, end] dates. We do
 * NOT impose calendar boundaries — fiscal year starts vary by tenant and
 * an Italian school year often spans Sept→Aug, not Jan→Dec.
 */

export type PnLLine = { category: string; total: number; count: number };

export type PnLReport = {
  period: { start: string; end: string };
  revenues: PnLLine[];
  revenueTotal: number;
  costs: PnLLine[];
  costTotal: number;
  netMargin: number;
  marginPct: number; // netMargin / revenueTotal × 100, 0 when revenueTotal=0
  movementCount: number;
};

export async function getPnL(
  tenantId: string,
  period: { start: Date; end: Date },
): Promise<PnLReport> {
  const movements = await prisma.accountingMovement.findMany({
    where: {
      tenantId,
      date: { gte: period.start, lte: period.end },
    },
    select: {
      type: true,
      category: true,
      amount: true,
    },
  });

  const revenueBuckets = new Map<string, { total: number; count: number }>();
  const costBuckets = new Map<string, { total: number; count: number }>();

  let revenueTotal = 0;
  let costTotal = 0;

  for (const m of movements) {
    const key = m.category ?? 'altro';
    const amount = Number(m.amount);
    const bucket = m.type === 'REVENUE' ? revenueBuckets : costBuckets;
    const entry = bucket.get(key) ?? { total: 0, count: 0 };
    entry.total = round2(entry.total + amount);
    entry.count += 1;
    bucket.set(key, entry);
    if (m.type === 'REVENUE') revenueTotal = round2(revenueTotal + amount);
    else costTotal = round2(costTotal + amount);
  }

  const revenues: PnLLine[] = Array.from(revenueBuckets.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);
  const costs: PnLLine[] = Array.from(costBuckets.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);

  const netMargin = round2(revenueTotal - costTotal);
  const marginPct = revenueTotal > 0 ? round2((netMargin / revenueTotal) * 100) : 0;

  return {
    period: {
      start: period.start.toISOString().slice(0, 10),
      end: period.end.toISOString().slice(0, 10),
    },
    revenues,
    revenueTotal,
    costs,
    costTotal,
    netMargin,
    marginPct,
    movementCount: movements.length,
  };
}

/**
 * Month-over-month series for a tenant. Returns 12 buckets ending at the
 * provided cutoff month (default: current month). Used for dashboard
 * trend lines.
 */
export async function getPnLTrend(
  tenantId: string,
  endYear: number,
  endMonth: number,
  monthsBack = 12,
): Promise<Array<{ year: number; month: number; revenue: number; cost: number; margin: number }>> {
  const earliest = new Date(Date.UTC(endYear, endMonth - 1, 1));
  earliest.setUTCMonth(earliest.getUTCMonth() - (monthsBack - 1));

  const latest = new Date(Date.UTC(endYear, endMonth, 0, 23, 59, 59, 999));

  const grouped = await prisma.$queryRaw<Array<{ y: number; m: number; type: string; total: number }>>`
    SELECT
      EXTRACT(YEAR FROM date)::int  AS y,
      EXTRACT(MONTH FROM date)::int AS m,
      type::text                    AS type,
      SUM(amount)::float            AS total
    FROM accounting_movements
    WHERE "tenantId" = ${tenantId}
      AND date >= ${earliest}
      AND date <= ${latest}
    GROUP BY 1, 2, 3
    ORDER BY 1, 2
  `;

  // Materialize the full month series even if some months have zero rows.
  const buckets: Array<{ year: number; month: number; revenue: number; cost: number; margin: number }> = [];
  const cursor = new Date(earliest);
  for (let i = 0; i < monthsBack; i++) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const rev = grouped.find((g) => g.y === y && g.m === m && g.type === 'REVENUE')?.total ?? 0;
    const cost = grouped.find((g) => g.y === y && g.m === m && g.type === 'COST')?.total ?? 0;
    buckets.push({
      year: y,
      month: m,
      revenue: round2(rev),
      cost: round2(cost),
      margin: round2(rev - cost),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return buckets;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
