import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  denominazione: z.string().max(200).nullable().optional(),
  nome: z.string().max(80).nullable().optional(),
  cognome: z.string().max(80).nullable().optional(),
  pec: z.string().email().nullable().optional(),
  codiceDestinatario: z.string().toUpperCase().optional(),
  regimeFiscale: z.string().nullable().optional(),
  indirizzo: z.string().min(1).max(200).optional(),
  cap: z.string().min(1).max(10).optional(),
  comune: z.string().min(1).max(80).optional(),
  provincia: z.string().length(2).toUpperCase().nullable().optional(),
  nazione: z.string().length(2).toUpperCase().optional(),
  email: z.string().email().nullable().optional(),
  telefono: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'invoice' } });
    const { id } = await params;

    const existing = await prisma.invoiceCustomerProfile.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, _count: { select: { invoices: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Anagrafica non trovata' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    // We deliberately do NOT allow editing CF / P.IVA on a profile that has
    // already been used for an emitted invoice — those values are frozen
    // into the issued XML and editing them here would create confusion. To
    // change fiscal codes, create a new profile.

    const updated = await prisma.invoiceCustomerProfile.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ profile: updated });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('customer-profile PATCH error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'delete', resource: 'invoice' } });
    const { id } = await params;

    const existing = await prisma.invoiceCustomerProfile.findFirst({
      where: tenantScope(ctx, { id }),
      select: { id: true, _count: { select: { invoices: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Anagrafica non trovata' }, { status: 404 });

    if (existing._count.invoices > 0) {
      return NextResponse.json(
        { error: 'Anagrafica usata da fatture esistenti. Per ragioni di audit non può essere eliminata.' },
        { status: 409 },
      );
    }

    await prisma.invoiceCustomerProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('customer-profile DELETE error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
