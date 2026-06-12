import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope, getTeacherIdForUser } from '@/lib/api-auth';

const createSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  notes: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'payroll' } });
    const sp = request.nextUrl.searchParams;
    const year = sp.get('year') ? parseInt(sp.get('year')!, 10) : undefined;
    const status = sp.get('status') ?? undefined;

    const where: any = tenantScope(ctx);
    if (year) where.year = year;
    if (status) where.status = status;

    // Include leggero dei cedolini per l'espansione in UI.
    // I TEACHER vedono SOLO i propri cedolini (filtro su Teacher.id risolto
    // dalla sessione; sentinella se l'utente non ha un Teacher associato).
    let payrollsWhere: { teacherId: string } | undefined;
    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      payrollsWhere = { teacherId: teacherId ?? '__no_teacher__' };
    }

    const periods = await prisma.payrollPeriod.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { payrolls: true } },
        payrolls: {
          where: payrollsWhere,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            netAmount: true,
            grossBase: true,
            extrasTotal: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    return NextResponse.json({ periods });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/**
 * Idempotent create: re-posting the same {year, month} returns the existing
 * period instead of throwing the unique-constraint error to the UI.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'payroll' } });
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    const period = await prisma.payrollPeriod.upsert({
      where: { tenantId_year_month: { tenantId: ctx.tenantId, year: parsed.data.year, month: parsed.data.month } },
      create: {
        tenantId: ctx.tenantId,
        year: parsed.data.year,
        month: parsed.data.month,
        notes: parsed.data.notes,
        status: 'OPEN',
      },
      update: {
        notes: parsed.data.notes ?? undefined,
      },
    });

    return NextResponse.json({ period }, { status: 201 });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('payroll periods POST error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
