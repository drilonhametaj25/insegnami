import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Lead del sito pubblico (form contatti → ContactRequest).
 * Solo SUPERADMIN: lista paginata + marcatura "gestito" (handledAt).
 */

async function requireSuperadmin() {
  const session = await getAuth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) };
  }
  if (session.user.role !== 'SUPERADMIN') {
    return { error: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) };
  }
  return { session };
}

// GET /api/superadmin/leads?page=&limit=&handled=true|false
export async function GET(request: NextRequest) {
  const auth = await requireSuperadmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const handled = searchParams.get('handled'); // 'true' | 'false' | null

    const where =
      handled === 'true'
        ? { handledAt: { not: null } }
        : handled === 'false'
          ? { handledAt: null }
          : {};

    const [leads, total, unhandledCount] = await Promise.all([
      prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactRequest.count({ where }),
      prisma.contactRequest.count({ where: { handledAt: null } }),
    ]);

    return NextResponse.json({
      leads,
      summary: { total, unhandled: unhandledCount },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('SuperAdmin leads GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PATCH /api/superadmin/leads — body: { id: string, handled: boolean }
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperadmin();
  if (auth.error) return auth.error;

  try {
    let body: { id?: string; handled?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
    }

    if (!body.id || typeof body.handled !== 'boolean') {
      return NextResponse.json(
        { error: 'Parametri richiesti: id (string), handled (boolean)' },
        { status: 400 }
      );
    }

    const lead = await prisma.contactRequest.update({
      where: { id: body.id },
      data: { handledAt: body.handled ? new Date() : null },
    });

    return NextResponse.json({ lead });
  } catch (error: any) {
    // Prisma P2025: record inesistente
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Lead non trovato' }, { status: 404 });
    }
    console.error('SuperAdmin leads PATCH error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
