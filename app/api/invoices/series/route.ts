import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

const createSchema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, 'Solo lettere maiuscole, numeri, _ e -'),
  prefix: z.string().max(10).optional(),
  description: z.string().max(200).optional(),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' } });
    const series = await prisma.invoiceSeries.findMany({
      where: tenantScope(ctx),
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    return NextResponse.json({ series });
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    // If isDefault=true, demote any existing default in the same tenant.
    // Done in a transaction so the unique-default invariant is preserved
    // even under concurrent creates.
    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.invoiceSeries.updateMany({
          where: { tenantId: ctx.tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.invoiceSeries.create({
        data: {
          tenantId: ctx.tenantId,
          code: parsed.data.code,
          prefix: parsed.data.prefix,
          description: parsed.data.description,
          isDefault: parsed.data.isDefault,
          yearCounters: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ series: result }, { status: 201 });
  } catch (err: any) {
    const r = authError(err);
    if (r) return r;
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Codice sezionale già in uso per questo tenant' }, { status: 409 });
    }
    console.error('series POST error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
