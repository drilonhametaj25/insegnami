import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { isValidPartitaIva, isValidCodiceFiscale, isValidCodiceDestinatario } from '@/lib/billing/sdi/codes';

const profileSchema = z.object({
  studentId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  denominazione: z.string().max(200).optional(),
  nome: z.string().max(80).optional(),
  cognome: z.string().max(80).optional(),
  codiceFiscale: z.string().toUpperCase().optional(),
  partitaIva: z.string().optional(),
  pec: z.string().email().optional(),
  codiceDestinatario: z.string().toUpperCase().default('0000000'),
  regimeFiscale: z.string().optional(),
  indirizzo: z.string().min(1).max(200),
  cap: z.string().min(1).max(10),
  comune: z.string().min(1).max(80),
  provincia: z.string().length(2).toUpperCase().optional(),
  nazione: z.string().length(2).toUpperCase().default('IT'),
  email: z.string().email().optional(),
  telefono: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

function validateFiscal(data: z.infer<typeof profileSchema>): string | null {
  // SDI requires at least one of partitaIva / codiceFiscale.
  if (!data.partitaIva && !data.codiceFiscale) {
    return 'Almeno uno tra partita IVA e codice fiscale è obbligatorio';
  }
  if (data.partitaIva && !isValidPartitaIva(data.partitaIva)) {
    return 'Partita IVA non valida (checksum errato)';
  }
  if (data.codiceFiscale && !isValidCodiceFiscale(data.codiceFiscale)) {
    return 'Codice fiscale non valido (formato errato)';
  }
  if (!isValidCodiceDestinatario(data.codiceDestinatario)) {
    return 'Codice destinatario deve essere 7 caratteri alfanumerici (es. 0000000 per recapito via PEC)';
  }
  // For private individuals, codiceDestinatario "0000000" is valid only when PEC is set OR codiceFiscale is set.
  if (data.codiceDestinatario === '0000000' && !data.pec && !data.codiceFiscale) {
    return 'Senza codice destinatario è obbligatoria la PEC oppure il codice fiscale';
  }
  // Either denominazione (legal entity) or nome+cognome (natural person).
  if (!data.denominazione && !(data.nome && data.cognome)) {
    return 'Inserisci la ragione sociale, oppure nome + cognome per persona fisica';
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' } });
    const sp = request.nextUrl.searchParams;
    const search = sp.get('search')?.trim();
    const studentId = sp.get('studentId') ?? undefined;

    const where: any = tenantScope(ctx);
    if (studentId) where.studentId = studentId;
    if (search) {
      where.OR = [
        { denominazione: { contains: search, mode: 'insensitive' } },
        { cognome: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
        { partitaIva: { contains: search } },
        { codiceFiscale: { contains: search } },
      ];
    }

    const profiles = await prisma.invoiceCustomerProfile.findMany({
      where,
      orderBy: [{ denominazione: 'asc' }, { cognome: 'asc' }],
      take: 200,
    });
    return NextResponse.json({ profiles });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'invoice' } });
    const body = await request.json().catch(() => ({}));
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    const fiscalError = validateFiscal(parsed.data);
    if (fiscalError) {
      return NextResponse.json({ error: fiscalError }, { status: 400 });
    }

    // Cross-tenant check on optional foreign keys.
    if (parsed.data.studentId) {
      const ok = await prisma.student.findFirst({
        where: { id: parsed.data.studentId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!ok) return NextResponse.json({ error: 'Studente non trovato' }, { status: 400 });
    }

    const profile = await prisma.invoiceCustomerProfile.create({
      data: {
        tenantId: ctx.tenantId,
        ...parsed.data,
      },
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('customer-profiles POST error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
