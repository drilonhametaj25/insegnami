import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope, getTeacherIdForUser } from '@/lib/api-auth';
import { recomputePayrollTotals } from '@/lib/payroll/payroll-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const lineItemSchema = z.object({
  type: z.enum(['HOURS', 'BONUS', 'EXPENSE_REIMBURSEMENT', 'ADJUSTMENT', 'OTHER']),
  description: z.string().min(1).max(200),
  quantity: z.number().optional(),
  unitAmount: z.number(),
  total: z.number(),
  lessonId: z.string().cuid().optional(),
});

const withholdingSchema = z.object({
  type: z.enum(['RITENUTA_ACCONTO', 'INPS', 'INAIL', 'OTHER']),
  label: z.string().min(1).max(120),
  rate: z.number().min(0).max(100),
  base: z.number(),
  amount: z.number(),
});

const patchSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
  /** Replace ALL extras (non-HOURS line items). HOURS rows are managed by generator. */
  extras: z.array(lineItemSchema).optional(),
  withholdings: z.array(withholdingSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'payroll' } });
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
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'payroll' } });
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

    await prisma.$transaction(async (tx) => {
      if (parsed.data.notes !== undefined) {
        await tx.payroll.update({ where: { id }, data: { notes: parsed.data.notes } });
      }
      if (parsed.data.extras) {
        // Delete existing non-HOURS line items, recreate from input.
        await tx.payrollLineItem.deleteMany({ where: { payrollId: id, type: { not: 'HOURS' as any } } });
        if (parsed.data.extras.length > 0) {
          await tx.payrollLineItem.createMany({
            data: parsed.data.extras.map((e) => ({
              payrollId: id,
              type: e.type as any,
              description: e.description,
              quantity: e.quantity != null ? new Decimal(e.quantity) : null,
              unitAmount: new Decimal(e.unitAmount),
              total: new Decimal(e.total),
              lessonId: e.lessonId ?? null,
            })),
          });
        }
      }
      if (parsed.data.withholdings) {
        await tx.payrollWithholding.deleteMany({ where: { payrollId: id } });
        if (parsed.data.withholdings.length > 0) {
          await tx.payrollWithholding.createMany({
            data: parsed.data.withholdings.map((w) => ({
              payrollId: id,
              type: w.type as any,
              label: w.label,
              rate: new Decimal(w.rate),
              base: new Decimal(w.base),
              amount: new Decimal(w.amount),
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
    const ctx = await requireAuth({ permission: { action: 'delete', resource: 'payroll' } });
    const { id } = await params;

    const existing = await prisma.payroll.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo i cedolini DRAFT possono essere eliminati. Per regenerare, eliminare prima il draft esistente.' },
        { status: 409 },
      );
    }

    await prisma.payroll.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
