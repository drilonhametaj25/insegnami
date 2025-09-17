import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = await params;

    // Check if message exists and belongs to tenant
    const message = await prisma.message.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
      include: {
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

    // Only sender or admin can send
    if (message.senderId !== session.user.id && !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Can't send already sent messages
    if (message.status === 'SENT') {
      return NextResponse.json({ error: 'Messaggio già inviato' }, { status: 400 });
    }

    // Update message status
    const updatedMessage = await prisma.message.update({
      where: { id: id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
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

    // Update recipient statuses
    if (message.sendEmail) {
      await prisma.messageRecipient.updateMany({
        where: { messageId: id },
        data: { emailStatus: 'SENT' },
      });
    }

    if (message.sendSms) {
      await prisma.messageRecipient.updateMany({
        where: { messageId: id },
        data: { smsStatus: 'SENT' },
      });
    }

    if (message.sendPush) {
      await prisma.messageRecipient.updateMany({
        where: { messageId: id },
        data: { pushStatus: 'SENT' },
      });
    }

    // TODO: Queue message for actual delivery
    // - Add to email queue if sendEmail is true
    // - Add to SMS queue if sendSms is true
    // - Send push notification if sendPush is true
    
    // Example of what you'd do with BullMQ:
    /*
    if (message.sendEmail) {
      await emailQueue.add('sendMessage', {
        messageId: id,
        recipients: message.recipients.map(r => r.user.email),
        subject: message.emailSubject,
        content: message.content,
        template: message.emailTemplate,
      });
    }
    */

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
