import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';
import { endOfDay } from '@/lib/dates';

const createSchema = z.object({
  date: z.string(),
  type: z.enum(['REVENUE', 'COST']),
  category: z.string().min(1).max(80),
  amount: z.number().positive(),
  currency: z.string().default('EUR'),
  description: z.string().max(500).optional(),
  classId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'accounting' }, feature: 'accounting' });
    const sp = request.nextUrl.searchParams;

    const where: any = tenantScope(ctx);
    if (sp.get('type')) where.type = sp.get('type');
    if (sp.get('source')) where.source = sp.get('source');
    if (sp.get('category')) where.category = sp.get('category');
    if (sp.get('from')) where.date = { ...(where.date ?? {}), gte: new Date(sp.get('from')!) };
    // endOfDay: include l'intero ultimo giorno del range richiesto
    if (sp.get('to')) where.date = { ...(where.date ?? {}), lte: endOfDay(new Date(sp.get('to')!)) };

    const page = Math.max(parseInt(sp.get('page') ?? '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(sp.get('pageSize') ?? '50', 10), 1), 200);

    const [movements, total] = await Promise.all([
      prisma.accountingMovement.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.accountingMovement.count({ where }),
    ]);

    return NextResponse.json({
      movements,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/**
 * POST — manual entry. Used for expenses that don't flow through Payment
 * or Payroll (rent, utilities, marketing, refunds with no Stripe trace).
 * source is forced to 'MANUAL' so the audit trail is unambiguous.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'accounting' }, feature: 'accounting' });
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    const movement = await prisma.accountingMovement.create({
      data: {
        tenantId: ctx.tenantId,
        date: new Date(parsed.data.date),
        type: parsed.data.type,
        source: 'MANUAL',
        category: parsed.data.category,
        amount: new Decimal(parsed.data.amount),
        currency: parsed.data.currency,
        description: parsed.data.description,
        classId: parsed.data.classId,
        courseId: parsed.data.courseId,
        studentId: parsed.data.studentId,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
