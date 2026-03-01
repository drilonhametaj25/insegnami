import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EmailNotificationService } from '@/lib/email-queue';

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

    // Queue message for actual delivery
    if (message.sendEmail && message.recipients.length > 0) {
      try {
        // Send email to all recipients
        const recipientEmails = message.recipients
          .map(r => r.user.email)
          .filter((email): email is string => !!email);

        if (recipientEmails.length > 0) {
          await EmailNotificationService.sendGenericEmail({
            to: recipientEmails,
            subject: message.emailSubject || message.title || 'Messaggio da InsegnaMi.pro',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3b82f6;">${message.title || 'Messaggio'}</h2>
                <div style="margin: 20px 0; line-height: 1.6;">
                  ${message.content.replace(/\n/g, '<br>')}
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">
                  Questo messaggio è stato inviato tramite InsegnaMi.pro
                </p>
              </div>
            `,
            text: message.content,
          });
        }
      } catch (emailError) {
        console.error('Error queueing email:', emailError);
        // Don't fail the entire request, just log the error
      }
    }

    // TODO: Implement SMS and Push notifications when services are available
    // if (message.sendSms) { ... }
    // if (message.sendPush) { ... }

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
