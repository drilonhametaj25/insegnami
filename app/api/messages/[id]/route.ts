import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema for message update
const messageUpdateSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto').optional(),
  content: z.string().min(1, 'Contenuto richiesto').optional(),
  scheduledAt: z.string().datetime().optional(),
  sendEmail: z.boolean().optional(),
  sendSms: z.boolean().optional(),
  sendPush: z.boolean().optional(),
  emailTemplate: z.string().optional(),
  emailSubject: z.string().optional(),
  priority: z.number().min(0).max(2).optional(),
  isUrgent: z.boolean().optional(),
  requiresResponse: z.boolean().optional(),
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

    const message = await prisma.message.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
    }

    // Role-based access control
    const canAccess = 
      session.user.role === 'ADMIN' ||
      session.user.role === 'SUPERADMIN' ||
      message.senderId === session.user.id ||
      message.recipients.some(r => r.userId === session.user.id);

    if (!canAccess) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Mark as read if user is a recipient
    if (message.recipients.some(r => r.userId === session.user.id && !r.emailReadAt)) {
      await prisma.messageRecipient.updateMany({
        where: {
          messageId: id,
          userId: session.user.id,
        },
        data: {
          emailReadAt: new Date(),
        },
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
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

    const body = await request.json();
    const validatedData = messageUpdateSchema.parse(body);
    const { id } = await params;

    // Check if message exists and belongs to tenant
    const existingMessage = await prisma.message.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
    }

    // Only sender or admin can update
    if (existingMessage.senderId !== session.user.id && !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Can't update sent messages
    if (existingMessage.status === 'SENT') {
      return NextResponse.json({ error: 'Impossibile modificare messaggi già inviati' }, { status: 400 });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: id },
      data: {
        ...validatedData,
        ...(validatedData.scheduledAt && { scheduledAt: new Date(validatedData.scheduledAt) }),
        status: validatedData.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating message:', error);
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

    const { id } = await params;

    // Check if message exists and belongs to tenant
    const existingMessage = await prisma.message.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
    }

    // Only sender or admin can delete
    if (existingMessage.senderId !== session.user.id && !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Can't delete sent messages
    if (existingMessage.status === 'SENT') {
      return NextResponse.json({ error: 'Impossibile eliminare messaggi già inviati' }, { status: 400 });
    }

    // Delete message (this will cascade delete recipients)
    await prisma.message.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Messaggio eliminato con successo' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
