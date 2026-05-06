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
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' } });
    const { id } = await params;

    const where: any = tenantScope(ctx, { id });
    if (ctx.role === 'PARENT') {
      where.customerProfile = { student: { parentUserId: ctx.userId } };
    }

    const invoice = await prisma.invoice.findFirst({
      where,
      select: {
        id: true,
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

    const filename = `IT_${invoice.sdiIdentifier ?? invoice.id}.xml`;
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
