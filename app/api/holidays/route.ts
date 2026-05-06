import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { seedItalianHolidays } from '@/lib/scheduling/holidays';

const holidaySchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1).max(120),
  recurring: z.boolean().default(false),
  academicYearId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// GET /api/holidays?from=2026-09-01&to=2027-08-31
export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const academicYearId = searchParams.get('academicYearId');

  const where: any = { tenantId: session.user.tenantId };
  if (from || to) {
    where.OR = [
      { recurring: true },
      {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
    ];
  }
  if (academicYearId) where.academicYearId = academicYearId;

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: [{ recurring: 'desc' }, { date: 'asc' }],
  });

  return NextResponse.json({ holidays });
}

// POST /api/holidays — single create OR `?seed=italian` to bootstrap defaults
export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('seed') === 'italian') {
    const inserted = await seedItalianHolidays(session.user.tenantId);
    return NextResponse.json({
      success: true,
      seeded: inserted,
      message: `Inserite ${inserted} festività italiane (i duplicati sono stati saltati).`,
    });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = holidaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const holiday = await prisma.holiday.create({
      data: {
        tenantId: session.user.tenantId,
        date: new Date(parsed.data.date),
        name: parsed.data.name,
        recurring: parsed.data.recurring,
        academicYearId: parsed.data.academicYearId,
        notes: parsed.data.notes,
      },
    });
    return NextResponse.json({ holiday }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Una vacanza con stessa data e nome esiste già' },
        { status: 409 },
      );
    }
    throw err;
  }
}
