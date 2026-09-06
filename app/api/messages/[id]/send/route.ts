import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EmailNotificationService } from '@/lib/email-queue';
import { rateLimitByKey } from '@/lib/rate-limit';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

// B3.4: quota per-tenant anti-DoS sull'invio messaggi — max invii/ora
const MSGSEND_QUEUE_MAX_PER_HOUR = 200;
const MSGSEND_QUEUE_WINDOW_MS = 3600000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

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
    if (message.senderId !== session.user.id && !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Can't send already sent messages
    if (message.status === 'SENT') {
      return NextResponse.json({ error: 'Messaggio già inviato' }, { status: 400 });
    }

    // B3.4: quota per-tenant prima del fan-out — un tenant non può saturare
    // la coda email. Check PRIMA della transaction: con 429 il messaggio
    // resta in DRAFT e può essere reinviato più tardi.
    const withinQuota = await rateLimitByKey(
      session.user.tenantId,
      MSGSEND_QUEUE_MAX_PER_HOUR,
      MSGSEND_QUEUE_WINDOW_MS,
      'rl:queue:msgsend'
    );
    if (!withinQuota) {
      return NextResponse.json(
        {
          error:
            'Quota oraria di invio messaggi esaurita per questa scuola. Il messaggio resta in bozza: riprova più tardi.',
        },
        { status: 429 }
      );
    }

    // BUG-046 fix: Wrap message and recipient updates in transaction for atomicity
    const updatedMessage = await prisma.$transaction(async (tx) => {
      // Update message status
      const updated = await tx.message.update({
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

      // Stati onesti per i canali: email resta SCHEDULED e diventa SENT solo
      // DOPO l'enqueue riuscito (fuori transaction). SMS e push non hanno
      // alcun provider implementato: l'enum MessageStatus non prevede
      // NOT_SENT, quindi usiamo FAILED (il valore onesto disponibile) invece
      // del vecchio 'SENT' fittizio.
      if (message.sendSms) {
        await tx.messageRecipient.updateMany({
          where: { messageId: id },
          data: { smsStatus: 'FAILED' }, // canale SMS non implementato
        });
      }

      if (message.sendPush) {
        await tx.messageRecipient.updateMany({
          where: { messageId: id },
          data: { pushStatus: 'FAILED' }, // canale push non implementato
        });
      }

      return updated;
    });

    // Queue message for actual delivery. emailStatus diventa SENT SOLO dopo
    // l'enqueue riuscito; se l'enqueue fallisce marca FAILED (onesto).
    if (message.sendEmail && message.recipients.length > 0) {
      const recipientEmails = message.recipients
        .map(r => r.user.email)
        .filter((email): email is string => !!email);

      try {
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
            meta: {
              tenantId: session.user.tenantId,
              sourceType: 'message',
              sourceId: message.id,
            },
          });

          await prisma.messageRecipient.updateMany({
            where: { messageId: id },
            data: { emailStatus: 'SENT' },
          });
        }
      } catch (emailError) {
        console.error('Error queueing email:', emailError);
        // Coda non disponibile: lo stato riflette il mancato invio
        try {
          await prisma.messageRecipient.updateMany({
            where: { messageId: id },
            data: { emailStatus: 'FAILED' },
          });
        } catch (statusError) {
          console.error('Error updating email status:', statusError);
        }
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
