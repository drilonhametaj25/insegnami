import { NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { isDevBilling } from '@/lib/billing/billing-mode';

/**
 * GET /api/subscriptions/invoices — storico fatture Stripe del customer del
 * tenant per la billing page. Envelope { data, meta }.
 *
 * - dev-billing: nessuna fattura reale → array vuoto (la UI mostra empty state)
 * - senza stripeCustomerId: array vuoto
 * skipTenantAccessCheck: la route deve restare consultabile anche da tenant
 * bloccati (servono le fatture proprio per regolarizzare il pagamento).
 */
export async function GET() {
  try {
    const ctx = await requireAuth({
      roles: ['ADMIN', 'DIRECTOR', 'SUPERADMIN'],
      skipTenantAccessCheck: true,
    });

    if (isDevBilling()) {
      return NextResponse.json({ data: [], meta: { devBilling: true } });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      return NextResponse.json({ data: [], meta: { devBilling: false } });
    }

    const invoices = await stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 24,
    });

    const data = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      // Stripe usa centesimi: normalizziamo in unità di valuta
      amount: (inv.total ?? 0) / 100,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
    }));

    return NextResponse.json({ data, meta: { devBilling: false } });
  } catch (err) {
    const authRes = authError(err);
    if (authRes) return authRes;
    console.error('subscriptions invoices error:', err);
    return NextResponse.json(
      { error: 'Errore nel recupero delle fatture' },
      { status: 500 }
    );
  }
}
