import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { calculateTimesheet, periodBounds } from './timesheet-calculator';
import { applyWithholdings, parseWithholdingsFromSettings } from './withholdings';

export type GenerateResult = {
  periodId: string;
  generated: number;
  skipped: number;
  errors: Array<{ teacherId: string; reason: string }>;
};

/**
 * Generate Payroll DRAFT rows for every active Teacher in a period.
 *
 * Idempotent: existing Payroll rows for the (periodId, teacherId) pair
 * are skipped (re-generation has to go through delete-then-regenerate
 * to avoid silently overwriting human edits to extras/withholdings).
 *
 * Snapshot strategy: hourlyRate is captured at generation time as
 * `Payroll.hourlyRateSnapshot`. If the school later changes
 * Teacher.hourlyRate, already-generated cedolini stay anchored to the
 * rate that was effective when the period was settled.
 *
 * Scope rules:
 *   - PayrollPeriod.status must be OPEN. LOCKED/PAID periods are read-only.
 *   - Only Teacher.status = ACTIVE in the period's tenant.
 *   - Teachers with hourlyRate=null AND no extras are skipped (nothing
 *     to compute — surfaced as "skipped" in the result so admin sees them).
 */
export async function generatePayrollForPeriod(periodId: string): Promise<GenerateResult> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, tenantId: true, year: true, month: true, status: true },
  });
  if (!period) throw new Error(`Period ${periodId} not found`);
  if (period.status !== 'OPEN') {
    throw new Error(`Period is ${period.status}; only OPEN periods can be generated`);
  }

  const { start: periodStart, end: periodEnd } = periodBounds(period.year, period.month);

  const teachers = await prisma.teacher.findMany({
    where: { tenantId: period.tenantId, status: 'ACTIVE' },
    select: {
      id: true, firstName: true, lastName: true, hourlyRate: true,
      payrollSettings: { select: { defaultWithholdings: true } } as any,
    },
  });

  // Skip teachers who already have a Payroll for this period.
  const existing = await prisma.payroll.findMany({
    where: { periodId, teacherId: { in: teachers.map((t) => t.id) } },
    select: { teacherId: true },
  });
  const existingSet = new Set(existing.map((p) => p.teacherId));

  const result: GenerateResult = {
    periodId,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  for (const teacher of teachers) {
    if (existingSet.has(teacher.id)) {
      result.skipped += 1;
      continue;
    }

    try {
      const hourlyRate = teacher.hourlyRate ? Number(teacher.hourlyRate) : 0;
      const timesheet = await calculateTimesheet(period.tenantId, teacher.id, periodStart, periodEnd);

      // Skip when there's literally nothing to bill: no hours and no rate.
      // We still record the skip so the admin sees the teacher in the UI.
      if (timesheet.totalHours === 0 && hourlyRate === 0) {
        result.skipped += 1;
        continue;
      }

      const grossBase = round2(timesheet.totalHours * hourlyRate);

      const withholdingsConfigs = parseWithholdingsFromSettings(
        (teacher as any).payrollSettings?.defaultWithholdings ?? [],
      );
      const wh = applyWithholdings(grossBase, withholdingsConfigs);

      const netAmount = round2(grossBase - wh.total);

      await prisma.$transaction(async (tx) => {
        await tx.payroll.create({
          data: {
            tenantId: period.tenantId,
            periodId: period.id,
            teacherId: teacher.id,
            hourlyRateSnapshot: new Decimal(hourlyRate),
            hoursWorked: new Decimal(timesheet.totalHours),
            grossBase: new Decimal(grossBase),
            extrasTotal: new Decimal(0),
            withholdingsTotal: new Decimal(wh.total),
            netAmount: new Decimal(netAmount),
            status: 'DRAFT',
            // One PayrollLineItem per Lesson lets the cedolino PDF show
            // a granular breakdown; HOURS lines are auto-generated, the
            // admin can later add BONUS/EXPENSE rows manually.
            lineItems: {
              create: timesheet.entries.map((e) => ({
                type: 'HOURS' as const,
                description: `${e.className} — ${e.startTime.toLocaleDateString('it-IT')} ${e.startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
                quantity: new Decimal(e.hours),
                unitAmount: new Decimal(hourlyRate),
                total: new Decimal(round2(e.hours * hourlyRate)),
                lessonId: e.lessonId,
              })),
            },
            withholdings: {
              create: wh.applied.map((w) => ({
                type: w.type,
                label: w.label,
                rate: new Decimal(w.rate),
                base: new Decimal(w.base),
                amount: new Decimal(w.amount),
              })),
            },
          },
        });
      });

      result.generated += 1;
    } catch (err) {
      logger.warn(`Payroll generation failed for teacher ${teacher.id}`, err);
      result.errors.push({
        teacherId: teacher.id,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return result;
}

/**
 * Recompute totals for a Payroll DRAFT after manual edits to lineItems
 * or withholdings. Idempotent. Caller must ensure the row is still DRAFT.
 */
export async function recomputePayrollTotals(payrollId: string, tx: Prisma.TransactionClient = prisma as any) {
  const payroll = await tx.payroll.findUnique({
    where: { id: payrollId },
    include: { lineItems: true, withholdings: true },
  });
  if (!payroll) throw new Error(`Payroll ${payrollId} not found`);
  if (payroll.status !== 'DRAFT') {
    throw new Error(`Payroll is ${payroll.status}; only DRAFT can be recomputed`);
  }

  const hoursTotal = payroll.lineItems
    .filter((l) => l.type === 'HOURS')
    .reduce((s, l) => s + Number(l.total), 0);
  const extrasTotal = payroll.lineItems
    .filter((l) => l.type !== 'HOURS')
    .reduce((s, l) => s + Number(l.total), 0);
  const grossBase = round2(hoursTotal);
  const withholdingsTotal = payroll.withholdings.reduce((s, w) => s + Number(w.amount), 0);
  const netAmount = round2(grossBase + extrasTotal - withholdingsTotal);

  return tx.payroll.update({
    where: { id: payrollId },
    data: {
      grossBase: new Decimal(grossBase),
      extrasTotal: new Decimal(round2(extrasTotal)),
      withholdingsTotal: new Decimal(round2(withholdingsTotal)),
      netAmount: new Decimal(netAmount),
    },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
