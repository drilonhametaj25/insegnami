import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';

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

    // Check if student has a parent user to notify
    if (!note.student.parentUser) {
      return NextResponse.json(
        { error: 'Nessun genitore associato a questo studente' },
        { status: 400 }
      );
    }

    // Create notification for parent
    await NotificationService.createNotification({
      tenantId: session.user.tenantId,
      userId: note.student.parentUser.id,
      title: `Nota disciplinare per ${note.student.firstName} ${note.student.lastName}`,
      content: `${note.title}: ${note.description.substring(0, 200)}${note.description.length > 200 ? '...' : ''}`,
      type: 'ATTENDANCE',
      priority: note.severity === 'HIGH' ? 'HIGH' : 'NORMAL',
      actionUrl: `/dashboard/students/${note.studentId}`,
      actionLabel: 'Vedi dettagli studente',
      sourceType: 'disciplinary_note',
      sourceId: note.id,
      sendEmail: true,
    });

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
