import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, authError } from '@/lib/api-auth';
import { isValidPartitaIva, isValidCodiceFiscale } from '@/lib/billing/sdi/codes';

const settingsSchema = z.object({
  denominazione: z.string().min(1).max(200),
  partitaIva: z.string(),
  codiceFiscale: z.string().toUpperCase(),
  regimeFiscale: z.string().regex(/^RF\d{2}$/, 'Codice regime fiscale RF01..RF19').default('RF01'),
  iscrizioneREA: z.string().max(50).nullable().optional(),
  capitaleSociale: z.number().nonnegative().nullable().optional(),
  socioUnico: z.enum(['SU', 'SM']).nullable().optional(),
  statoLiquidazione: z.enum(['LN', 'LS']).default('LN'),
  indirizzo: z.string().min(1).max(200),
  cap: z.string().min(1).max(10),
  comune: z.string().min(1).max(80),
  provincia: z.string().length(2).toUpperCase().nullable().optional(),
  nazione: z.string().length(2).toUpperCase().default('IT'),
  telefono: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  sdiProvider: z.enum(['file-system', 'acube', 'aruba', 'fatture-in-cloud']).default('file-system'),
  sdiCredentials: z.record(z.unknown()).optional(),
  conservazioneEnabled: z.boolean().default(false),
});

export async function GET() {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' } });
    const settings = await prisma.invoiceSettings.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    // Don't ship credentials to the client.
    const safe = settings ? { ...settings, sdiCredentials: settings.sdiCredentials ? '***' : null } : null;
    return NextResponse.json({ settings: safe });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/**
 * PUT /api/invoices/settings — upsert. The endpoint is PUT (not POST + PATCH)
 * because there's at most one settings row per tenant — the operation is
 * idempotent and the resource id is implicit.
 *
 * Credentials handling: if the client sends sdiCredentials we replace the
 * stored value. If they send sdiCredentials=null we clear it. If the field
 * is absent we keep what's stored — important so the UI can update other
 * fields without re-typing API keys.
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'update', resource: 'invoice' } });
    const body = await request.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!isValidPartitaIva(parsed.data.partitaIva)) {
      return NextResponse.json({ error: 'Partita IVA non valida (checksum errato)' }, { status: 400 });
    }
    if (!isValidCodiceFiscale(parsed.data.codiceFiscale)) {
      // CF di una persona giuridica usa il P.IVA — accettiamo entrambi i formati.
      if (!isValidPartitaIva(parsed.data.codiceFiscale)) {
        return NextResponse.json({ error: 'Codice fiscale non valido' }, { status: 400 });
      }
    }

    const { sdiCredentials, ...rest } = parsed.data;

    // Build the upsert payload. For PATCH-like behavior on credentials we
    // need to know if the field was present in the input — Zod strips it if
    // absent. The presence check uses the original body.
    const credentialsTouched = Object.prototype.hasOwnProperty.call(body, 'sdiCredentials');

    const settings = await prisma.invoiceSettings.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        ...rest,
        ...(credentialsTouched ? { sdiCredentials: (sdiCredentials as any) ?? undefined } : {}),
      },
      update: {
        ...rest,
        ...(credentialsTouched ? { sdiCredentials: (sdiCredentials as any) ?? null } : {}),
      },
    });

    const safe = { ...settings, sdiCredentials: settings.sdiCredentials ? '***' : null };
    return NextResponse.json({ settings: safe });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('settings PUT error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
