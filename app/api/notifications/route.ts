import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
        emailSent: !sendEmail, // Se non vogliamo email, marchiamo come già inviata
        pushSent: !sendPush,   // Se non vogliamo push, marchiamo come già inviata
      }
    });

    // TODO: Aggiungere alla queue per email/push se richiesti
    // if (sendEmail) {
    //   await addEmailNotificationJob(notification);
    // }
    // if (sendPush) {
    //   await addPushNotificationJob(notification);
    // }

    return NextResponse.json(notification, { status: 201 });

  } catch (error) {
    console.error('Errore nella creazione notifica:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
