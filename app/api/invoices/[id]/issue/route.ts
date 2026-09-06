import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { assignInvoiceNumber } from '@/lib/billing/invoice-numbering';
import { validateInvoiceFiscalData } from '@/lib/billing/sdi/fiscal-validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/issue
 *
 * Transitions an invoice from DRAFT to ISSUED, assigning the next sequential
 * number for its series + year. Atomic — wraps the number assignment and the
 * Invoice.update in a single transaction so a failed update rolls back the
 * counter (preserving sequence integrity).
 *
 * Once ISSUED the invoice is fiscally immutable: only Notes of Credit can
 * counteract it. The /[id] PATCH/DELETE routes refuse non-DRAFT records.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'invoice' }, feature: 'einvoicing' });
    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: tenantScope(ctx, { id }),
      select: {
        id: true,
        status: true,
        seriesId: true,
        year: true,
        customerProfileId: true,
        _count: { select: { lines: true } },
        lines: { select: { lineNumber: true, vatRate: true, vatNature: true } },
        customerProfile: {
          select: {
            codiceFiscale: true, partitaIva: true, cap: true,
            nazione: true, codiceDestinatario: true, pec: true,
          },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Fattura già emessa (stato: ${existing.status})` },
        { status: 409 },
      );
    }
    if (existing._count.lines === 0) {
      return NextResponse.json(
        { error: 'Impossibile emettere una fattura senza righe' },
        { status: 400 },
      );
    }

    // Validazione fiscale PRIMA di consumare un numero: un XML che SDI
    // scarterebbe non deve bruciare la numerazione progressiva.
    const problems = validateInvoiceFiscalData({
      lines: existing.lines,
      customer: existing.customerProfile,
    });
    if (problems.length > 0) {
      return NextResponse.json(
        { error: 'Dati fiscali incompleti: correggi prima di emettere', fields: problems },
        { status: 422 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const number = await assignInvoiceNumber(tx, {
        seriesId: existing.seriesId,
        year: existing.year,
      });

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          number,
          status: 'ISSUED',
        },
        include: {
          series: { select: { code: true, prefix: true } },
        },
      });
      return updated;
    });

    return NextResponse.json({ invoice: result });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice issue error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
