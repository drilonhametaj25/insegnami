import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';

const updateSchema = z.object({
  date: z.string().optional(),
  name: z.string().min(1).max(120).optional(),
  recurring: z.boolean().optional(),
  academicYearId: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminRole(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
  }

  // Tenant scope check before update — Prisma does not enforce it on updates by id alone.
  const existing = await prisma.holiday.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Vacanza non trovata' }, { status: 404 });

  const updated = await prisma.holiday.update({
    where: { id },
    data: {
      ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.recurring !== undefined ? { recurring: parsed.data.recurring } : {}),
      ...(parsed.data.academicYearId !== undefined ? { academicYearId: parsed.data.academicYearId } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
  });

  return NextResponse.json({ holiday: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminRole(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.holiday.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Vacanza non trovata' }, { status: 404 });

  await prisma.holiday.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
