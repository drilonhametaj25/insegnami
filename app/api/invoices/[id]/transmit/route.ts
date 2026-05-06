import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { buildFatturaPA } from '@/lib/billing/sdi/xml-builder';
import { getSdiProviderForTenant } from '@/lib/billing/sdi/factory';
import { SdiProviderError } from '@/lib/billing/sdi/provider.interface';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/transmit
 *
 * Builds the FatturaPA XML, persists it on the Invoice, hands it off to the
 * tenant's configured SDI provider, and updates Invoice.sdiStatus to
 * TRANSMITTED. The provider then forwards to SDI, and final acceptance/
 * rejection arrives later via webhook → /api/webhooks/sdi/[provider]
 * → SdiEvent rows + sdiStatus update.
 *
 * Idempotency: if the invoice is already transmitted, refuses to re-send
 * (would create duplicate SDI submissions). The caller can re-issue under a
 * new number if they need to retry.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'invoice' } });
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: tenantScope(ctx, { id }),
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        customerProfile: true,
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    if (invoice.status === 'DRAFT') {
      return NextResponse.json(
        { error: 'Emetti la fattura prima di trasmetterla al SDI' },
        { status: 409 },
      );
    }
    if (invoice.sdiStatus === 'TRANSMITTED' || invoice.sdiStatus === 'ACCEPTED') {
      return NextResponse.json(
        { error: `Fattura già trasmessa (stato SDI: ${invoice.sdiStatus})` },
        { status: 409 },
      );
    }

    const settings = await prisma.invoiceSettings.findUnique({
      where: { tenantId: invoice.tenantId },
    });
    if (!settings) {
      return NextResponse.json(
        { error: 'Impostazioni fatturazione mancanti. Configura InvoiceSettings prima di trasmettere.' },
        { status: 412 },
      );
    }

    // Progressivo invio: SDI requires a unique progressive per trasmittente
    // per session, ASCII ≤10 char. Year + 4-digit sequence is well under.
    const progressivoInvio = `${invoice.year}${String(invoice.number).padStart(4, '0')}`;

    let xml: string;
    try {
      xml = buildFatturaPA({
        invoice,
        lines: invoice.lines,
        customer: invoice.customerProfile,
        settings,
        progressivoInvio,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'XML build failed';
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const provider = await getSdiProviderForTenant(invoice.tenantId);

    let providerId: string;
    try {
      const result = await provider.transmit({
        xml,
        invoiceId: invoice.id,
        tenantId: invoice.tenantId,
      });
      if (!result.accepted) {
        return NextResponse.json(
          { error: `Provider SDI ha rifiutato: ${result.errorMessage ?? 'motivo sconosciuto'}` },
          { status: 502 },
        );
      }
      providerId = result.providerId;
    } catch (err) {
      const message = err instanceof SdiProviderError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'errore sconosciuto';
      return NextResponse.json({ error: `Trasmissione fallita: ${message}` }, { status: 502 });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        xmlContent: xml,
        sdiIdentifier: providerId,
        sdiStatus: 'TRANSMITTED',
        sdiTransmittedAt: new Date(),
        status: invoice.status === 'ISSUED' ? 'SENT' : invoice.status,
      },
    });

    return NextResponse.json({ invoice: updated, providerId });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice transmit error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
