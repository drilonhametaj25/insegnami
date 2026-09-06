import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  paidAt: z.string().datetime().optional(),
  paymentReference: z.string().max(120).optional(),
});

/**
 * POST /api/payroll/[id]/mark-paid — APPROVED → PAID.
 *
 * Atomic: status flip + AccountingMovement(COST) creation in one
 * transaction. The movement is the source-of-truth for P&L; if we
 * created it lazily (e.g. on dashboard read), the cost would be
 * invisible until the dashboard is hit.
 *
 * Movement details:
 *   - type=COST, source=PAYROLL, category='stipendi'
 *   - amount = Payroll.netAmount
 *   - date  = paidAt (defaults to now)
 *   - refType=PAYROLL, refId=payrollId
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({
      roles: ['ADMIN', 'DIRECTOR', 'SUPERADMIN'],
      permission: { action: 'update', resource: 'payroll' },
      feature: 'payroll',
    });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.payroll.findFirst({
      where: tenantScope(ctx, { id }),
      select: {
        id: true, status: true, tenantId: true, teacherId: true, netAmount: true,
        period: { select: { year: true, month: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });
    if (existing.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Stato ${existing.status}: il cedolino deve essere APPROVED prima di essere PAID` },
        { status: 409 },
      );
    }

    const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payroll.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt,
          paymentReference: parsed.data.paymentReference,
        },
      });

      // Idempotency: skip movement creation if one already exists for
      // this payroll (e.g. retry of a transient failure).
      const existingMovement = await tx.accountingMovement.findFirst({
        where: { payrollId: id },
        select: { id: true },
      });

      let movementId: string | null = existingMovement?.id ?? null;
      if (!existingMovement) {
        const movement = await tx.accountingMovement.create({
          data: {
            tenantId: existing.tenantId,
            date: paidAt,
            type: 'COST',
            source: 'PAYROLL',
            category: 'stipendi',
            amount: new Decimal(Number(existing.netAmount)),
            currency: 'EUR',
            description: `Cedolino ${existing.period.month}/${existing.period.year}`,
            payrollId: id,
            createdBy: ctx.userId,
          },
          select: { id: true },
        });
        movementId = movement.id;
      }

      return { payroll: updated, movementId };
    });

    return NextResponse.json(result);
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('payroll mark-paid error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
