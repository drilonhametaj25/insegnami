import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const templates = await prisma.messageTemplate.findMany({
      where: {
        tenantId: session.user.tenantId,
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
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can create templates
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

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
        tenantId: session.user.tenantId,
        creatorId: session.user.id,
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
