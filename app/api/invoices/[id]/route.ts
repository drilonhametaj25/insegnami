import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { computeInvoiceTotals } from '@/lib/billing/invoice-totals';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Stessa shape del POST /api/invoices: le righe di una bozza sono
// interamente rimpiazzabili finché la fattura resta DRAFT.
const lineSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity: z.number().positive().default(1),
  unitPrice: z.number(),
  vatRate: z.number().min(0).max(100),
  vatNature: z.string().regex(/^N[1-7](\.[0-9])?$/).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  paymentId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
});

const patchSchema = z.object({
  customerProfileId: z.string().cuid().optional(),
  paymentMethod: z.string().regex(/^MP\d{2}$/).optional(),
  paymentTerms: z.array(z.object({
    dueDate: z.string().datetime().optional(),
    amount: z.number().optional(),
    iban: z.string().optional(),
  })).optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** Replace integrale delle righe (solo DRAFT): totali ricalcolati server-side. */
  lines: z.array(lineSchema).min(1, 'Almeno una riga richiesta').optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' }, feature: 'einvoicing' });
    const { id } = await params;

    const where: any = tenantScope(ctx, { id });
    if (ctx.role === 'PARENT') {
      // Guardian-aware: StudentGuardian + fallback legacy parentUserId
      where.customerProfile = {
        student: {
          OR: [
            { parentUserId: ctx.userId },
            { guardians: { some: { userId: ctx.userId } } },
          ],
        },
      };
    }

    const invoice = await prisma.invoice.findFirst({
      where,
      include: {
        series: true,
        customerProfile: true,
        lines: { orderBy: { lineNumber: 'asc' } },
        sdiEvents: { orderBy: { receivedAt: 'desc' } },
        payments: { select: { id: true, status: true, amount: true, paidDate: true } },
        relatedInvoice: { select: { id: true, number: true, year: true, documentType: true } },
        creditNotes: { select: { id: true, number: true, year: true, documentType: true, status: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice GET error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'invoice' }, feature: 'einvoicing' });
    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Solo le fatture in stato DRAFT sono modificabili (stato attuale: ${existing.status}). Per correggere usa una nota di credito.` },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    const baseData = {
      ...(parsed.data.customerProfileId ? { customerProfileId: parsed.data.customerProfileId } : {}),
      ...(parsed.data.paymentMethod !== undefined ? { paymentMethod: parsed.data.paymentMethod } : {}),
      ...(parsed.data.paymentTerms !== undefined ? { paymentTerms: parsed.data.paymentTerms as any } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    };

    // Replace transazionale delle righe (solo DRAFT, verificato sopra):
    // delete + create + ricalcolo totali server-side con la stessa funzione
    // pura del POST — i valori del client non sono mai fidati.
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.lines) {
        const lines = parsed.data.lines;
        const { lineTotals, subtotal, vatTotal, total } = computeInvoiceTotals(lines);

        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: lines.map((l, idx) => ({
            invoiceId: id,
            lineNumber: idx + 1,
            description: l.description,
            quantity: new Prisma.Decimal(l.quantity),
            unitPrice: new Prisma.Decimal(l.unitPrice),
            vatRate: new Prisma.Decimal(l.vatRate),
            vatNature: l.vatNature,
            discountPercent: l.discountPercent ? new Prisma.Decimal(l.discountPercent) : null,
            total: new Prisma.Decimal(lineTotals[idx]),
            paymentId: l.paymentId,
            studentId: l.studentId,
            courseId: l.courseId,
          })),
        });

        return tx.invoice.update({
          where: { id },
          data: {
            ...baseData,
            subtotal: new Prisma.Decimal(subtotal),
            vatTotal: new Prisma.Decimal(vatTotal),
            total: new Prisma.Decimal(total),
          },
          include: { lines: { orderBy: { lineNumber: 'asc' } } },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: baseData,
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
    });

    return NextResponse.json({ invoice: updated });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice PATCH error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'delete', resource: 'invoice' }, feature: 'einvoicing' });
    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, tenantId: true, seriesId: true, number: true, year: true, status: true, total: true },
    });
    if (!existing) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      // Italian fiscal law: an emitted invoice cannot be deleted, only nullified
      // via a credit note. The UI must surface this clearly.
      return NextResponse.json(
        { error: 'Una fattura emessa non può essere eliminata. Usa una nota di credito.' },
        { status: 409 },
      );
    }

    // Audit DELETE (C0.4): snapshot della bozza nella stessa transazione del delete
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        tenantId: existing.tenantId,
        userId: ctx.userId,
        action: 'DELETE',
        entity: 'Invoice',
        entityId: id,
        oldData: {
          id: existing.id,
          seriesId: existing.seriesId,
          number: existing.number,
          year: existing.year,
          status: existing.status,
          total: Number(existing.total),
        },
        request,
      });

      await tx.invoice.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice DELETE error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
