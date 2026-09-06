import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, authError } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

/**
 * Dati di fatturazione del cliente SaaS (campi fiscali sul Tenant):
 * billingName / vatNumber / taxCode / sdiCode / pec.
 * Envelope { data, meta }. skipTenantAccessCheck: modificabili anche da
 * tenant sospesi (servono per regolarizzare la posizione).
 */

const BILLING_ROLES = ['ADMIN', 'DIRECTOR', 'SUPERADMIN'] as const;

// Stringhe vuote → null PRIMA della validazione (la UI invia '' per i campi
// non compilati; una PEC vuota non deve fallire la validazione email)
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable()).optional();

const billingInfoSchema = z.object({
  billingName: optionalText(200),
  vatNumber: optionalText(20),
  taxCode: optionalText(20),
  sdiCode: optionalText(10),
  pec: z.preprocess(emptyToNull, z.string().email().max(200).nullable()).optional(),
});

const BILLING_SELECT = {
  billingName: true,
  vatNumber: true,
  taxCode: true,
  sdiCode: true,
  pec: true,
} as const;

// GET /api/subscriptions/billing-info — dati fiscali correnti del tenant
export async function GET() {
  try {
    const ctx = await requireAuth({
      roles: [...BILLING_ROLES],
      skipTenantAccessCheck: true,
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: BILLING_SELECT,
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    return NextResponse.json({ data: tenant, meta: {} });
  } catch (err) {
    const authRes = authError(err);
    if (authRes) return authRes;
    console.error('billing-info GET error:', err);
    return NextResponse.json(
      { error: 'Errore nel recupero dei dati di fatturazione' },
      { status: 500 }
    );
  }
}

// PUT /api/subscriptions/billing-info — aggiorna i campi fiscali del tenant
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAuth({
      roles: [...BILLING_ROLES],
      skipTenantAccessCheck: true,
    });

    const body = await request.json().catch(() => ({}));
    const parsed = billingInfoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Normalizza stringhe vuote a null (campi opzionali fiscali)
    const data: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      data[key] = typeof value === 'string' && value.trim() === '' ? null : value;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo da aggiornare' },
        { status: 400 }
      );
    }

    const updated = await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data,
      select: BILLING_SELECT,
    });

    return NextResponse.json({ data: updated, meta: {} });
  } catch (err) {
    const authRes = authError(err);
    if (authRes) return authRes;
    console.error('billing-info PUT error:', err);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento dei dati di fatturazione" },
      { status: 500 }
    );
  }
}
