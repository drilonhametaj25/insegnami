import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope, getTeacherIdForUser } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { recomputePayrollTotals } from '@/lib/payroll/payroll-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const lineItemSchema = z.object({
  type: z.enum(['HOURS', 'BONUS', 'EXPENSE_REIMBURSEMENT', 'ADJUSTMENT', 'OTHER']),
  description: z.string().min(1).max(200),
  quantity: z.number().optional(),
  unitAmount: z.number(),
  // total del client ignorato: ricalcolato server-side (quantity × unitAmount)
  total: z.number().optional(),
  lessonId: z.string().cuid().optional(),
});

const withholdingSchema = z.object({
  type: z.enum(['RITENUTA_ACCONTO', 'INPS', 'INAIL', 'OTHER']),
  label: z.string().min(1).max(120),
  rate: z.number().min(0).max(100),
  // base/amount del client ignorati: riapplicati da recomputePayrollTotals
  base: z.number().optional(),
  amount: z.number().optional(),
});

const patchSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
  /** Replace ALL extras (non-HOURS line items). HOURS rows are managed by generator. */
  extras: z.array(lineItemSchema).optional(),
  withholdings: z.array(withholdingSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'payroll' }, feature: 'payroll' });
    const { id } = await params;

    const where: any = tenantScope(ctx, { id });
    // Teachers can read their own payroll only.
    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      where.teacherId = teacherId ?? '__no_teacher__';
    }

    const payroll = await prisma.payroll.findFirst({
      where,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true, teacherCode: true } },
        period: true,
        lineItems: { orderBy: { id: 'asc' } },
        withholdings: { orderBy: { id: 'asc' } },
      },
    });
    if (!payroll) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });
    return NextResponse.json({ payroll });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/**
 * PATCH — only DRAFT payrolls. Replacing `extras` and `withholdings`
 * arrays in full keeps the route idempotent and avoids "edit one of N"
 * which is awkward to authorise without exposing the inner ids.
 *
 * After replacement we recompute the aggregate totals so the cedolino
 * PDF stays consistent.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'payroll' }, feature: 'payroll' });
    const { id } = await params;

    const existing = await prisma.payroll.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Stato ${existing.status}: solo i cedolini DRAFT sono modificabili` },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    // Le righe HOURS sono di esclusiva competenza del generatore (timesheet):
    // un extra di tipo HOURS aggirerebbe il calcolo ore → 400.
    if (parsed.data.extras?.some((e) => e.type === 'HOURS')) {
      return NextResponse.json(
        { error: 'Le righe di tipo HOURS sono gestite dal generatore e non modificabili come extra' },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.data.notes !== undefined) {
        await tx.payroll.update({ where: { id }, data: { notes: parsed.data.notes } });
      }
      if (parsed.data.extras) {
        // Delete existing non-HOURS line items, recreate from input.
        await tx.payrollLineItem.deleteMany({ where: { payrollId: id, type: { not: 'HOURS' as any } } });
        if (parsed.data.extras.length > 0) {
          await tx.payrollLineItem.createMany({
            data: parsed.data.extras.map((e) => {
              // total SEMPRE ricalcolato server-side: quantity × unitAmount
              const total = round2((e.quantity ?? 1) * e.unitAmount);
              return {
                payrollId: id,
                type: e.type as any,
                description: e.description,
                quantity: e.quantity != null ? new Decimal(e.quantity) : null,
                unitAmount: new Decimal(e.unitAmount),
                total: new Decimal(total),
                lessonId: e.lessonId ?? null,
              };
            }),
          });
        }
      }
      if (parsed.data.withholdings) {
        await tx.payrollWithholding.deleteMany({ where: { payrollId: id } });
        if (parsed.data.withholdings.length > 0) {
          // base/amount a 0: valori reali riapplicati da recomputePayrollTotals
          // (aliquota sulla nuova base) — i numeri del client sono ignorati.
          await tx.payrollWithholding.createMany({
            data: parsed.data.withholdings.map((w) => ({
              payrollId: id,
              type: w.type as any,
              label: w.label,
              rate: new Decimal(w.rate),
              base: new Decimal(0),
              amount: new Decimal(0),
            })),
          });
        }
      }
      await recomputePayrollTotals(id, tx as any);
    });

    const fresh = await prisma.payroll.findUnique({
      where: { id },
      include: { lineItems: true, withholdings: true },
    });
    return NextResponse.json({ payroll: fresh });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('payroll PATCH error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'delete', resource: 'payroll' }, feature: 'payroll' });
    const { id } = await params;

    const existing = await prisma.payroll.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, tenantId: true, teacherId: true, periodId: true, status: true, netAmount: true },
    });
    if (!existing) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo i cedolini DRAFT possono essere eliminati. Per regenerare, eliminare prima il draft esistente.' },
        { status: 409 },
      );
    }

    // Audit DELETE (C0.4): snapshot del cedolino nella stessa transazione del delete
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        tenantId: existing.tenantId,
        userId: ctx.userId,
        action: 'DELETE',
        entity: 'Payroll',
        entityId: id,
        oldData: {
          id: existing.id,
          teacherId: existing.teacherId,
          periodId: existing.periodId,
          status: existing.status,
          netAmount: Number(existing.netAmount),
        },
        request: _request,
      });

      await tx.payroll.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
