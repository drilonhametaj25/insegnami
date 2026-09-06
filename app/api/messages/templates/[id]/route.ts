import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, authError } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Update parziale: stessi vincoli dello schema della collection
const templateUpdateSchema = z.object({
  name: z.string().min(1, 'Nome richiesto').optional(),
  description: z.string().nullable().optional(),
  subject: z.string().min(1, 'Oggetto richiesto').optional(),
  content: z.string().min(1, 'Contenuto richiesto').optional(),
  type: z.enum(['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'URGENT', 'MESSAGE', 'NEWSLETTER']).optional(),
  variables: z.array(z.string()).optional(),
});

// PUT /api/messages/templates/[id] — aggiorna un template
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Stessi ruoli della collection: strumenti interni dello staff
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'],
      permission: { action: 'update', resource: 'message' },
    });
    const { id } = await params;

    const body = await request.json();
    const parsed = templateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Template non trovato' }, { status: 404 });
    }

    const { variables, ...rest } = parsed.data;
    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        ...rest,
        ...(variables !== undefined ? { variables: JSON.stringify(variables) } : {}),
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/messages/templates/[id] — elimina un template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'],
      permission: { action: 'delete', resource: 'message' },
    });
    const { id } = await params;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Template non trovato' }, { status: 404 });
    }

    await prisma.messageTemplate.delete({ where: { id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
