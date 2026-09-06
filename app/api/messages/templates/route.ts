import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, authError } from '@/lib/api-auth';

// Schema for template validation
const templateSchema = z.object({
  name: z.string().min(1, 'Nome richiesto'),
  description: z.string().optional(),
  subject: z.string().min(1, 'Oggetto richiesto'),
  content: z.string().min(1, 'Contenuto richiesto'),
  type: z.enum(['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'URGENT', 'MESSAGE', 'NEWSLETTER']).default('MESSAGE'),
  variables: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Roles espliciti: message:read in matrice include STUDENT/PARENT, ma i template sono strumenti interni
    const ctx = await requireAuth({ roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'] });

    const templates = await prisma.messageTemplate.findMany({
      where: {
        tenantId: ctx.tenantId,
        isActive: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { usageCount: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Permesso message:create via matrice (sblocca DIRECTOR/SECRETARY); i ruoli
    // espliciti restano perché i template sono strumenti interni (come la GET).
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'],
      permission: { action: 'create', resource: 'message' },
    });

    const body = await request.json();
    const validatedData = templateSchema.parse(body);

    const template = await prisma.messageTemplate.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        subject: validatedData.subject,
        content: validatedData.content,
        type: validatedData.type,
        variables: validatedData.variables ? JSON.stringify(validatedData.variables) : null,
        tenantId: ctx.tenantId,
        creatorId: ctx.userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    const authRes = authError(error);
    if (authRes) return authRes;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
