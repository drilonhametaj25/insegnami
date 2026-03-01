import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EmailNotificationService } from '@/lib/email-queue';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: any = {
      userId: session.user.id,
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (unreadOnly) where.status = 'UNREAD';

    // Condizioni per data
    const now = new Date();
    where.AND = [
      {
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } }
        ]
      },
      {
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } }
        ]
      }
    ];

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where })
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Errore nel recupero notifiche:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      content,
      type,
      priority = 'NORMAL',
      userId,
      actionUrl,
      actionLabel,
      sourceType,
      sourceId,
      scheduledFor,
      expiresAt,
      sendEmail = false,
      sendPush = true
    } = body;

    // Validazione input
    if (!title || !content || !type) {
      return NextResponse.json(
        { error: 'Title, content e type sono obbligatori' },
        { status: 400 }
      );
    }

    // Per ora solo admin può creare notifiche per altri utenti
    const userTenant = await prisma.userTenant.findFirst({
      where: { 
        userId: session.user.id,
        role: { in: ['ADMIN', 'SUPERADMIN'] }
      }
    });

    const targetUserId = userId || session.user.id;
    
    // Se non è admin, può creare notifiche solo per se stesso
    if (!userTenant && targetUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Non autorizzato a creare notifiche per altri utenti' },
        { status: 403 }
      );
    }

    // Get tenant info
    const targetUserTenant = await prisma.userTenant.findFirst({
      where: { userId: targetUserId }
    });

    if (!targetUserTenant) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Get the target user's email for sending notifications
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true, firstName: true, lastName: true }
    });

    const notification = await prisma.notification.create({
      data: {
        tenantId: targetUserTenant.tenantId,
        userId: targetUserId,
        title,
        content,
        type,
        priority,
        actionUrl,
        actionLabel,
        sourceType,
        sourceId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        emailSent: false,
        pushSent: !sendPush,   // Push notification not implemented yet
      }
    });

    // Send email notification if requested and user has email
    if (sendEmail && targetUser?.email) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${title}</h2>
            <div style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">
              <p style="color: #555; line-height: 1.6;">${content}</p>
            </div>
            ${actionUrl ? `<p><a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px;">${actionLabel || 'Visualizza'}</a></p>` : ''}
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">Questa notifica è stata inviata da InsegnaMi.pro</p>
          </div>
        `;

        await EmailNotificationService.sendGenericEmail({
          to: targetUser.email,
          subject: `[InsegnaMi] ${title}`,
          html: emailHtml,
          text: `${title}\n\n${content}${actionUrl ? `\n\n${actionLabel || 'Visualizza'}: ${actionUrl}` : ''}`,
        });

        // Update notification to mark email as sent
        await prisma.notification.update({
          where: { id: notification.id },
          data: { emailSent: true }
        });
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
        // Don't fail the request, just log the error - notification is still created
      }
    } else if (!sendEmail) {
      // If email not requested, mark as already sent
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true }
      });
    }

    return NextResponse.json(notification, { status: 201 });

  } catch (error) {
    console.error('Errore nella creazione notifica:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
