import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for update
const updateParentMeetingSchema = z.object({
  date: z.string().transform((val) => new Date(val)).optional(),
  duration: z.number().min(5).max(120).optional(),
  room: z.string().optional().nullable(),
  parentNotes: z.string().optional(),
  teacherNotes: z.string().optional(),
});

// GET /api/parent-meetings/[id] - Get meeting detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const meeting = await prisma.parentMeeting.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
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
            studentCode: true,
            parentUserId: true,
          },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Colloquio non trovato' }, { status: 404 });
    }

    // Access control
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
      });
      if (!student || student.id !== meeting.studentId) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    } else if (session.user.role === 'PARENT') {
      if (meeting.parentId !== session.user.id) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher || teacher.id !== meeting.teacherId) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Parent meeting GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/parent-meetings/[id] - Update meeting
export async function PUT(
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

    // Access control - determine what can be updated based on role
    let canUpdate = false;
    let allowedFields: string[] = [];

    if (isAdminRole(session.user.role)) {
      canUpdate = true;
      allowedFields = ['date', 'duration', 'room', 'parentNotes', 'teacherNotes'];
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && teacher.id === meeting.teacherId) {
        canUpdate = true;
        allowedFields = ['date', 'duration', 'room', 'teacherNotes'];
      }
    } else if (session.user.role === 'PARENT') {
      if (meeting.parentId === session.user.id) {
        // Parents can only update notes and only if meeting is REQUESTED
        if (meeting.status === 'REQUESTED') {
          canUpdate = true;
          allowedFields = ['parentNotes'];
        }
      }
    }

    if (!canUpdate) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateParentMeetingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Filter to only allowed fields
    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in validation.data) {
        updateData[field] = (validation.data as any)[field];
      }
    }

    // If date is being changed, check for conflicts
    if (updateData.date) {
      const duration = updateData.duration || meeting.duration;
      const meetingEnd = new Date(updateData.date.getTime() + duration * 60000);
      const conflictingMeeting = await prisma.parentMeeting.findFirst({
        where: {
          id: { not: id },
          teacherId: meeting.teacherId,
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          date: {
            gte: new Date(updateData.date.getTime() - duration * 60000),
            lt: meetingEnd,
          },
        },
      });

      if (conflictingMeeting) {
        return NextResponse.json(
          { error: 'Slot orario non disponibile' },
          { status: 409 }
        );
      }
    }

    const updatedMeeting = await prisma.parentMeeting.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedMeeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Parent meeting PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/parent-meetings/[id] - Delete meeting
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const meeting = await prisma.parentMeeting.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Colloquio non trovato' }, { status: 404 });
    }

    // Only allow deletion of REQUESTED or CANCELLED meetings
    if (!['REQUESTED', 'CANCELLED'].includes(meeting.status)) {
      return NextResponse.json(
        { error: 'Solo i colloqui in attesa o cancellati possono essere eliminati' },
        { status: 400 }
      );
    }

    // Access control
    let canDelete = false;

    if (isAdminRole(session.user.role)) {
      canDelete = true;
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && teacher.id === meeting.teacherId) {
        canDelete = true;
      }
    } else if (session.user.role === 'PARENT') {
      // Parents can only delete their own REQUESTED meetings
      if (meeting.parentId === session.user.id && meeting.status === 'REQUESTED') {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    await prisma.parentMeeting.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Colloquio eliminato' });
  } catch (error) {
    console.error('Parent meeting DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
