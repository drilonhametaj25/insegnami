import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

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

    // Fix campanella: le notifiche DISMISSED non tornano più nell'elenco di
    // default (si vedono solo chiedendo esplicitamente ?status=DISMISSED)
    if (!where.status) where.status = { not: 'DISMISSED' };

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

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

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

    // SECURITY: admin check MUST be tenant-scoped. Without filtering on
    // the current request's tenantId, an ADMIN of tenant A would qualify
    // as admin when writing notifications targeted at tenant B users.
    // session.user.tenantId reflects the active tenant of the request.
    const callerTenant = session.user.tenantId;
    const userTenant = await prisma.userTenant.findFirst({
      where: {
        userId: session.user.id,
        tenantId: callerTenant,
        role: { in: ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'SUPERADMIN'] },
      },
    });

    const targetUserId = userId || session.user.id;

    if (!userTenant && targetUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Non autorizzato a creare notifiche per altri utenti' },
        { status: 403 }
      );
    }

    // SECURITY: target user lookup MUST be scoped to the caller's tenant.
    // SUPERADMIN may write cross-tenant; everyone else is locked to their
    // own tenant. Without this filter, a tenant A admin who guesses a
    // tenant B userId would produce a notification visible to that user.
    const targetUserTenant = await prisma.userTenant.findFirst({
      where: {
        userId: targetUserId,
        ...(session.user.role === 'SUPERADMIN' ? {} : { tenantId: callerTenant }),
      },
    });

    if (!targetUserTenant) {
      return NextResponse.json(
        { error: 'Utente non trovato in questo tenant' },
        { status: 404 }
      );
    }

    // Delegate row creation + email enqueue to the dispatcher. Single source
    // of truth for delivery: avoids the previous "create then maybe mark
    // emailSent" duplication that drifted between callers.
    const { createAndDispatch } = await import('@/lib/notifications/dispatcher');
    const { notification, emailEnqueued } = await createAndDispatch(
      {
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
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      { sendEmail, sendPush },
    );

    return NextResponse.json({ ...notification, emailEnqueued }, { status: 201 });

  } catch (error) {
    console.error('Errore nella creazione notifica:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
