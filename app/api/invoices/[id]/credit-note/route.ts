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
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'invoice' }, feature: 'einvoicing' });
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

    // Capienza CUMULATIVA: la somma delle note di credito già emesse su
    // questa fattura più la nuova non può superare il totale originale.
    const existingCreditNotes = await prisma.invoice.findMany({
      where: {
        tenantId: original.tenantId,
        relatedInvoiceId: original.id,
        documentType: 'TD04',
        status: { not: 'CANCELLED' },
      },
      select: { total: true },
    });
    const alreadyCredited = round2(
      existingCreditNotes.reduce((s, cn) => s + Math.abs(Number(cn.total)), 0),
    );
    const newCredit = partialAmount ?? Number(original.total);
    if (alreadyCredited + newCredit > Number(original.total) + 0.005) {
      return NextResponse.json(
        {
          error: `Capienza superata: già stornati € ${alreadyCredited.toFixed(2)} su un totale di € ${Number(original.total).toFixed(2)}`,
        },
        { status: 422 },
      );
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

function buildPartialLine(
  original: { lines: Array<any>; total: unknown },
  partialAmount: number,
  reason: string,
) {
  // Storno parziale: `partialAmount` è un importo LORDO (IVA inclusa) che va
  // scorporato proporzionalmente sulle aliquote delle righe originali — una
  // riga sintetica per ogni bucket (vatRate, vatNature), così i riepiloghi
  // IVA della nota di credito restano coerenti con la fattura stornata.
  type Bucket = { vatRate: number; vatNature: string | null; net: number; gross: number };
  const buckets = new Map<string, Bucket>();
  for (const l of original.lines) {
    const vatRate = Number(l.vatRate);
    const vatNature = l.vatNature ?? null;
    const key = `${vatRate}|${vatNature ?? ''}`;
    const net = Number(l.total);
    const existing = buckets.get(key);
    if (existing) {
      existing.net += net;
    } else {
      buckets.set(key, { vatRate, vatNature, net, gross: 0 });
    }
  }
  const list = Array.from(buckets.values());
  for (const b of list) b.gross = b.net * (1 + b.vatRate / 100);
  const grossTotal = list.reduce((s, b) => s + b.gross, 0);

  const abs = Math.abs(partialAmount);
  const lines: any[] = [];
  let allocated = 0;
  list.forEach((b, idx) => {
    // Quota lorda del bucket; l'ultimo assorbe il resto (quadratura al cent).
    const grossShare = idx === list.length - 1
      ? round2(abs - allocated)
      : round2((abs * b.gross) / grossTotal);
    allocated = round2(allocated + grossShare);
    const netShare = round2(grossShare / (1 + b.vatRate / 100));
    if (netShare === 0) return;
    lines.push({
      lineNumber: lines.length + 1,
      description: `Storno parziale — ${reason}`,
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(-netShare),
      vatRate: new Prisma.Decimal(b.vatRate),
      vatNature: b.vatNature,
      discountPercent: null,
      total: new Prisma.Decimal(-netShare),
      paymentId: null,
      studentId: null,
      courseId: null,
    });
  });
  return lines;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
