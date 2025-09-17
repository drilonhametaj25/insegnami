import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const noticeUpdateSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto').optional(),
  content: z.string().min(1, 'Contenuto richiesto').optional(),
  type: z.enum(['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'URGENT']).optional(),
  isPublic: z.boolean().optional(),
  targetRoles: z.array(z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'])).optional(),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isPinned: z.boolean().optional(),
  isUrgent: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = await params;

    const notice = await prisma.notice.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
        targetRoles: {
          has: session.user.role,
        },
        publishAt: { lte: new Date() },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (!notice) {
      return NextResponse.json({ error: 'Avviso non trovato' }, { status: 404 });
    }

    return NextResponse.json(notice);
  } catch (error) {
    console.error('Error fetching notice:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can update notices
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = noticeUpdateSchema.parse(body);
    const { id } = await params;

    // Check if notice exists and belongs to tenant
    const existingNotice = await prisma.notice.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingNotice) {
      return NextResponse.json({ error: 'Avviso non trovato' }, { status: 404 });
    }

    // Teachers can only update their own notices and have restrictions
    if (session.user.role === 'TEACHER') {
      if (validatedData.type === 'URGENT' || validatedData.isUrgent) {
        return NextResponse.json(
          { error: 'Solo gli amministratori possono creare avvisi urgenti' },
          { status: 403 }
        );
      }
      if (validatedData.isPinned) {
        return NextResponse.json(
          { error: 'Solo gli amministratori possono creare avvisi in evidenza' },
          { status: 403 }
        );
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.publishAt) {
      updateData.publishAt = new Date(validatedData.publishAt);
    }
    if (validatedData.expiresAt) {
      updateData.expiresAt = new Date(validatedData.expiresAt);
    }

    const updatedNotice = await prisma.notice.update({
      where: { id: id },
      data: updateData,
    });

    return NextResponse.json(updatedNotice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating notice:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can delete notices
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Check if notice exists and belongs to tenant
    const existingNotice = await prisma.notice.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingNotice) {
      return NextResponse.json({ error: 'Avviso non trovato' }, { status: 404 });
    }

    await prisma.notice.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Avviso eliminato con successo' });
  } catch (error) {
    console.error('Error deleting notice:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
