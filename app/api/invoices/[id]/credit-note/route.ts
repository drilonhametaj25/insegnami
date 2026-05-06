import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  /** If omitted, credits the entire invoice. */
  partialAmount: z.number().positive().optional(),
  reason: z.string().min(3).max(500),
  seriesId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/invoices/[id]/credit-note
 *
 * Creates a TD04 (Nota di Credito) DRAFT invoice that mirrors the original
 * invoice's lines (with negated totals if a full credit, or one synthetic
 * line if partial). The new invoice is linked via `relatedInvoiceId` so the
 * credit chain is auditable.
 *
 * The original invoice is NOT modified. To make an invoice "fiscally
 * cancelled" the workflow is: emit credit note → issue → transmit → wait
 * for SDI ACCEPT → mark original as CANCELLED (separate UI action). Doing
 * this all in one shot would mask audit data the next operator needs.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'invoice' } });
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }
    const { partialAmount, reason, seriesId, notes } = parsed.data;

    const original = await prisma.invoice.findFirst({
      where: tenantScope(ctx, { id }),
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!original) return NextResponse.json({ error: 'Fattura originale non trovata' }, { status: 404 });
    if (original.status === 'DRAFT') {
      return NextResponse.json(
        { error: 'Non puoi emettere una nota di credito su una bozza. Cancella la bozza invece.' },
        { status: 409 },
      );
    }
    if (original.status === 'CANCELLED') {
      return NextResponse.json({ error: 'La fattura originale è già annullata' }, { status: 409 });
    }
    if (partialAmount && partialAmount > Number(original.total)) {
      return NextResponse.json({ error: 'L\'importo parziale supera il totale della fattura' }, { status: 400 });
    }

    const series = await prisma.invoiceSeries.findFirst({
      where: { id: seriesId, tenantId: ctx.tenantId, isActive: true },
      select: { id: true },
    });
    if (!series) return NextResponse.json({ error: 'Sezionale non valido' }, { status: 400 });

    const issueDate = new Date();

    const linesData = partialAmount
      ? buildPartialLine(original, partialAmount, reason)
      : buildFullCreditLines(original, reason);

    const subtotal = round2(linesData.reduce((s, l) => s + Number(l.total), 0));
    const vatTotal = round2(linesData.reduce((s, l) => s + (Number(l.total) * Number(l.vatRate)) / 100, 0));
    const total = round2(subtotal + vatTotal);

    const creditNote = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        seriesId,
        customerProfileId: original.customerProfileId,
        documentType: 'TD04',
        issueDate,
        year: issueDate.getFullYear(),
        subtotal: new Prisma.Decimal(subtotal),
        vatTotal: new Prisma.Decimal(vatTotal),
        withholdingTotal: new Prisma.Decimal(0),
        total: new Prisma.Decimal(total),
        paymentMethod: original.paymentMethod,
        notes: [reason, notes].filter(Boolean).join('\n\n'),
        relatedInvoiceId: original.id,
        createdBy: ctx.userId,
        lines: { create: linesData },
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });

    return NextResponse.json({ creditNote }, { status: 201 });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('credit-note error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

function buildFullCreditLines(original: { lines: Array<any> }, reason: string) {
  // Full credit: replicate every line with NEGATED quantity. SDI accepts a
  // negative quantity on TD04; the resulting totals come out negative which
  // is the canonical credit-note representation.
  return original.lines.map((l) => ({
    lineNumber: l.lineNumber,
    description: `[NC] ${l.description} — ${reason}`,
    quantity: new Prisma.Decimal(-Math.abs(Number(l.quantity))),
    unitPrice: l.unitPrice,
    vatRate: l.vatRate,
    vatNature: l.vatNature ?? null,
    discountPercent: l.discountPercent ?? null,
    total: new Prisma.Decimal(-Math.abs(Number(l.total))),
    paymentId: l.paymentId ?? null,
    studentId: l.studentId ?? null,
    courseId: l.courseId ?? null,
  }));
}

function buildPartialLine(original: { lines: Array<any> }, partialAmount: number, reason: string) {
  // Partial credit: one synthetic line with the negative amount. We use the
  // VAT rate of the first original line as a heuristic — a partial credit
  // crossing multiple rates is rare in school billing; flag in notes if it
  // matters.
  const firstLine = original.lines[0];
  const vatRate = firstLine ? Number(firstLine.vatRate) : 0;
  const vatNature = firstLine?.vatNature ?? null;
  const negative = -Math.abs(partialAmount);
  return [
    {
      lineNumber: 1,
      description: `Storno parziale — ${reason}`,
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(negative),
      vatRate: new Prisma.Decimal(vatRate),
      vatNature,
      discountPercent: null,
      total: new Prisma.Decimal(negative),
      paymentId: null,
      studentId: null,
      courseId: null,
    },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
