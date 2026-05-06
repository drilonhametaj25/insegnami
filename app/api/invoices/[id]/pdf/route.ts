import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { buildInvoicePdf } from '@/lib/billing/pdf/invoice-pdf';
import { formatInvoiceNumber } from '@/lib/billing/invoice-numbering';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/invoices/[id]/pdf — stream rendered PDF inline. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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
        lines: { orderBy: { lineNumber: 'asc' } },
        customerProfile: true,
        series: { select: { prefix: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });

    const settings = await prisma.invoiceSettings.findUnique({
      where: { tenantId: invoice.tenantId },
    });
    if (!settings) {
      return NextResponse.json(
        { error: 'Impostazioni fatturazione mancanti — il PDF richiede dati cedente' },
        { status: 412 },
      );
    }

    const buffer = buildInvoicePdf({
      invoice,
      lines: invoice.lines,
      customer: invoice.customerProfile,
      settings,
      seriesPrefix: invoice.series.prefix,
    });

    const filename = invoice.number > 0
      ? `fattura-${formatInvoiceNumber(invoice.series.prefix, invoice.year, invoice.number).replace(/\//g, '-')}.pdf`
      : `bozza-${invoice.id}.pdf`;

    // NextResponse(BodyInit) doesn't accept Node Buffer in TS strict mode
    // even though it works at runtime — see existing report-cards/pdf route.
    // Cast to any to match the rest of the codebase's pattern.
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice pdf error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
