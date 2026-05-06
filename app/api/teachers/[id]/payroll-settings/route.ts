import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const withholdingConfigSchema = z.object({
  type: z.enum(['RITENUTA_ACCONTO', 'INPS', 'INAIL', 'OTHER']),
  rate: z.number().min(0).max(100),
  label: z.string().min(1).max(120),
  reducesBase: z.boolean().optional(),
});

const settingsSchema = z.object({
  taxRegime: z.enum(['FORFETTARIO', 'ORDINARIO', 'DIPENDENTE', 'COCOCO', 'OTHER']).default('ORDINARIO'),
  iban: z.string().max(34).nullable().optional(),
  defaultWithholdings: z.array(withholdingConfigSchema).default([]),
  notes: z.string().max(1000).nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'payroll' } });
    const { id: teacherId } = await params;

    const teacher = await prisma.teacher.findFirst({
      where: tenantScope(ctx, { id: teacherId }),
      select: {
        id: true,
        payrollSettings: true,
      } as any,
    });
    if (!teacher) return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });

    return NextResponse.json({ settings: (teacher as any).payrollSettings ?? null });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/**
 * PUT — upsert payroll settings for a teacher. The settings are 1:1 with
 * Teacher and the resource id is implicit, so PUT (not POST + PATCH).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({
      roles: ['ADMIN', 'DIRECTOR', 'SUPERADMIN'],
      permission: { action: 'update', resource: 'payroll' },
    });
    const { id: teacherId } = await params;

    // Tenant scope check on the teacher first.
    const teacher = await prisma.teacher.findFirst({
      where: tenantScope(ctx, { id: teacherId }),
      select: { id: true },
    });
    if (!teacher) return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }

    const settings = await prisma.teacherPayrollSettings.upsert({
      where: { teacherId },
      create: {
        teacherId,
        taxRegime: parsed.data.taxRegime,
        iban: parsed.data.iban ?? null,
        defaultWithholdings: parsed.data.defaultWithholdings as any,
        notes: parsed.data.notes ?? null,
      },
      update: {
        taxRegime: parsed.data.taxRegime,
        iban: parsed.data.iban ?? null,
        defaultWithholdings: parsed.data.defaultWithholdings as any,
        notes: parsed.data.notes ?? null,
      },
    });

    return NextResponse.json({ settings });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('teacher payroll settings PUT error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
