import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id]/xml — download the FatturaPA XML.
 *
 * The XML is generated and persisted on Invoice.xmlContent at transmit time,
 * NOT regenerated here. This is intentional: an emitted XML must match
 * exactly what was sent to SDI; rebuilding could produce a different output
 * if the customer profile or settings have been edited since (which the
 * application should generally allow, e.g. updating an address for future
 * invoices).
 *
 * Returns 412 when the invoice has never been transmitted.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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
      select: {
        id: true,
        tenantId: true,
        xmlContent: true,
        number: true,
        year: true,
        sdiIdentifier: true,
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    if (!invoice.xmlContent) {
      return NextResponse.json(
        { error: 'XML non disponibile — la fattura non è ancora stata trasmessa' },
        { status: 412 },
      );
    }

    // Convenzione SDI: IT<P.IVA cedente>_<progressivo alfanumerico>.xml.
    // Progressivo base36 a 5 char, deterministico su (anno, numero).
    const settings = await prisma.invoiceSettings.findUnique({
      where: { tenantId: invoice.tenantId },
      select: { partitaIva: true },
    });
    const piva = (settings?.partitaIva ?? '').replace(/^IT/i, '').trim();
    const progressivo = (invoice.year * 10000 + invoice.number)
      .toString(36)
      .toUpperCase()
      .padStart(5, '0')
      .slice(-5);
    const filename = `IT${piva}_${progressivo}.xml`;
    return new NextResponse(invoice.xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoice xml error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
