import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notifica non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);

  } catch (error) {
    console.error('Errore nel recupero notifica:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { status, action } = body;

    // Controlla che la notifica esista e appartenga all'utente
    const existingNotification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notifica non trovata' },
        { status: 404 }
      );
    }

    const updateData: any = {};

    if (action === 'markAsRead' || status === 'READ') {
      updateData.status = 'READ';
      updateData.readAt = new Date();
    } else if (action === 'dismiss' || status === 'DISMISSED') {
      updateData.status = 'DISMISSED';
      updateData.dismissedAt = new Date();
    } else if (status) {
      updateData.status = status;
    }

    const notification = await prisma.notification.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(notification);

  } catch (error) {
    console.error('Errore nell\'aggiornamento notifica:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Solo admin può eliminare notifiche
    const userTenant = await prisma.userTenant.findFirst({
      where: { 
        userId: session.user.id,
        role: { in: ['ADMIN', 'SUPERADMIN'] }
      }
    });

    if (!userTenant) {
      return NextResponse.json(
        { error: 'Non autorizzato a eliminare notifiche' },
        { status: 403 }
      );
    }

    // Controlla che la notifica esista nel tenant dell'admin
    const existingNotification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        tenantId: userTenant.tenantId,
      },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notifica non trovata' },
        { status: 404 }
      );
    }

    await prisma.notification.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Errore nell\'eliminazione notifica:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
