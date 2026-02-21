import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { MeetingStatus } from '@prisma/client';

// Validation schema
const updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED']),
  reason: z.string().optional(),
});

// Define valid status transitions
const statusTransitions: Record<MeetingStatus, MeetingStatus[]> = {
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [], // No transitions from cancelled
  COMPLETED: [], // No transitions from completed
};

// POST /api/parent-meetings/[id]/status - Change meeting status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the meeting
    const meeting = await prisma.parentMeeting.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentUserId: true,
          },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Colloquio non trovato' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { status: newStatus, reason } = validation.data;

    // Check if transition is valid
    const allowedTransitions = statusTransitions[meeting.status];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Transizione non valida: da ${meeting.status} a ${newStatus}`,
          allowedTransitions,
        },
        { status: 400 }
      );
    }

    // Access control based on role and status change
    let canChangeStatus = false;
    let isTeacher = false;
    let isParent = false;

    if (['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      canChangeStatus = true;
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && teacher.id === meeting.teacherId) {
        isTeacher = true;
        // Teachers can: CONFIRM, CANCEL, COMPLETE
        if (['CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(newStatus)) {
          canChangeStatus = true;
        }
      }
    } else if (session.user.role === 'PARENT') {
      if (meeting.parentId === session.user.id) {
        isParent = true;
        // Parents can only CANCEL their own REQUESTED meetings
        if (newStatus === 'CANCELLED' && meeting.status === 'REQUESTED') {
          canChangeStatus = true;
        }
      }
    }

    if (!canChangeStatus) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    // Update the meeting status
    const updatedMeeting = await prisma.parentMeeting.update({
      where: { id },
      data: {
        status: newStatus,
        // Add reason to notes if provided
        ...(reason && isTeacher && { teacherNotes: meeting.teacherNotes ? `${meeting.teacherNotes}\n[${newStatus}]: ${reason}` : `[${newStatus}]: ${reason}` }),
        ...(reason && isParent && { parentNotes: meeting.parentNotes ? `${meeting.parentNotes}\n[${newStatus}]: ${reason}` : `[${newStatus}]: ${reason}` }),
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentUserId: true,
          },
        },
      },
    });

    // Send notifications based on status change
    try {
      const dateStr = meeting.date.toLocaleDateString('it-IT');
      const timeStr = meeting.date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      if (newStatus === 'CONFIRMED' && meeting.student.parentUserId) {
        // Notify parent that meeting is confirmed
        await prisma.notification.create({
          data: {
            tenantId: meeting.tenantId,
            userId: meeting.student.parentUserId,
            title: 'Colloquio confermato',
            content: `Il colloquio con ${meeting.teacher.firstName} ${meeting.teacher.lastName} per ${meeting.student.firstName} il ${dateStr} alle ${timeStr} è stato confermato.`,
            type: 'MEETING',
            priority: 'HIGH',
            sourceType: 'parentMeeting',
            sourceId: meeting.id,
            actionUrl: `/dashboard/meetings/${meeting.id}`,
          },
        });
      } else if (newStatus === 'CANCELLED') {
        // Notify the other party about cancellation
        if (isTeacher && meeting.student.parentUserId) {
          // Teacher cancelled - notify parent
          await prisma.notification.create({
            data: {
              tenantId: meeting.tenantId,
              userId: meeting.student.parentUserId,
              title: 'Colloquio cancellato',
              content: `Il colloquio con ${meeting.teacher.firstName} ${meeting.teacher.lastName} per ${meeting.student.firstName} il ${dateStr} è stato cancellato.${reason ? ` Motivo: ${reason}` : ''}`,
              type: 'MEETING',
              priority: 'NORMAL',
              sourceType: 'parentMeeting',
              sourceId: meeting.id,
            },
          });
        } else if (isParent && meeting.teacher.email) {
          // Parent cancelled - notify teacher
          const teacherUser = await prisma.user.findFirst({
            where: { email: meeting.teacher.email },
          });
          if (teacherUser) {
            await prisma.notification.create({
              data: {
                tenantId: meeting.tenantId,
                userId: teacherUser.id,
                title: 'Colloquio cancellato',
                content: `Il colloquio per ${meeting.student.firstName} ${meeting.student.lastName} il ${dateStr} è stato cancellato dal genitore.${reason ? ` Motivo: ${reason}` : ''}`,
                type: 'MEETING',
                priority: 'NORMAL',
                sourceType: 'parentMeeting',
                sourceId: meeting.id,
              },
            });
          }
        }
      }
      // No notification for COMPLETED status
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      previousStatus: meeting.status,
      newStatus,
      meeting: updatedMeeting,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Parent meeting status POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
