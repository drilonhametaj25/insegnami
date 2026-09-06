import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAndDispatch } from '@/lib/notifications/dispatcher';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/disciplinary-notes/[id]/notify-parent
 * BUG-056 fix: Endpoint to notify parent about disciplinary note
 * and update the parentNotified flag
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only teachers and admins can notify parents
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Find disciplinary note with student and parent info
    const note = await prisma.disciplinaryNote.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        student: {
          include: {
            parentUser: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Nota non trovata' }, { status: 404 });
    }

    if (note.parentNotified) {
      return NextResponse.json(
        { error: 'Genitore già notificato', notifiedAt: note.parentNotifiedAt },
        { status: 400 }
      );
    }

    // Destinatari guardian-aware: StudentGuardian + fallback legacy parentUser
    const guardianLinks = await prisma.studentGuardian.findMany({
      where: { studentId: note.studentId, tenantId: session.user.tenantId },
      select: { userId: true },
    });
    const recipientIds = Array.from(
      new Set([
        ...(note.student.parentUser ? [note.student.parentUser.id] : []),
        ...guardianLinks.map((g) => g.userId),
      ])
    );

    if (recipientIds.length === 0) {
      return NextResponse.json(
        { error: 'Nessun genitore associato a questo studente' },
        { status: 400 }
      );
    }

    // B3.2: crea la notifica E la dispatcha davvero via email (il vecchio
    // createNotification marcava emailSent=true senza inviare nulla)
    for (const recipientId of recipientIds) {
      await createAndDispatch(
        {
          tenantId: session.user.tenantId,
          userId: recipientId,
          title: `Nota disciplinare per ${note.student.firstName} ${note.student.lastName}`,
          content: `${note.title}: ${note.description.substring(0, 200)}${note.description.length > 200 ? '...' : ''}`,
          type: 'ATTENDANCE',
          priority: note.severity === 'HIGH' ? 'HIGH' : 'NORMAL',
          // Vista genitore, non rotta admin
          actionUrl: '/it/dashboard/my/notes',
          actionLabel: 'Vedi le note',
          sourceType: 'disciplinary_note',
          sourceId: note.id,
        },
        { sendEmail: true }
      );
    }

    // Update the parentNotified flag
    const updatedNote = await prisma.disciplinaryNote.update({
      where: { id },
      data: {
        parentNotified: true,
        parentNotifiedAt: new Date(),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Genitore di ${updatedNote.student.firstName} ${updatedNote.student.lastName} notificato`,
      notifiedAt: updatedNote.parentNotifiedAt,
    });
  } catch (error) {
    console.error('Error notifying parent:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
