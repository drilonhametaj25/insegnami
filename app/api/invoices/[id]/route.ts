import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  customerProfileId: z.string().cuid().optional(),
  paymentMethod: z.string().regex(/^MP\d{2}$/).optional(),
  paymentTerms: z.array(z.object({
    dueDate: z.string().datetime().optional(),
    amount: z.number().optional(),
    iban: z.string().optional(),
  })).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' } });
    const { id } = await params;

    const where: any = tenantScope(ctx, { id });
    if (ctx.role === 'PARENT') {
      where.customerProfile = { student: { parentUserId: ctx.userId } };
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
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'invoice' } });
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

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(parsed.data.customerProfileId ? { customerProfileId: parsed.data.customerProfileId } : {}),
        ...(parsed.data.paymentMethod !== undefined ? { paymentMethod: parsed.data.paymentMethod } : {}),
        ...(parsed.data.paymentTerms !== undefined ? { paymentTerms: parsed.data.paymentTerms as any } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      },
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
    const ctx = await requireAuth({ permission: { action: 'delete', resource: 'invoice' } });
    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, status: true, number: true },
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

    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice DELETE error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
