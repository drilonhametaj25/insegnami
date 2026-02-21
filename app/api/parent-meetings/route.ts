import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { MeetingStatus } from '@prisma/client';

// Validation schema
const createParentMeetingSchema = z.object({
  studentId: z.string().min(1, 'Lo studente è obbligatorio'),
  teacherId: z.string().optional(),
  date: z.string().transform((val) => new Date(val)),
  duration: z.number().min(5).max(120).default(15),
  room: z.string().optional().nullable(),
  parentNotes: z.string().optional(),
  teacherNotes: z.string().optional(),
});

// GET /api/parent-meetings - List parent meetings with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    // Tenant scoping
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Role-based filtering
    if (session.user.role === 'PARENT') {
      // Parents see meetings for their children
      const children = await prisma.student.findMany({
        where: {
          parentUserId: session.user.id,
          tenantId: session.user.tenantId,
        },
        select: { id: true },
      });
      if (children.length === 0) {
        return NextResponse.json({
          meetings: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        });
      }
      where.studentId = { in: children.map((c) => c.id) };
    } else if (session.user.role === 'STUDENT') {
      // Students see their own meetings (readonly)
      const student = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      });
      if (!student) {
        return NextResponse.json({
          meetings: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        });
      }
      where.studentId = student.id;
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      // Teachers see their own meetings
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher) {
        return NextResponse.json({
          meetings: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        });
      }
      where.teacherId = teacher.id;
    }
    // ADMIN and SUPERADMIN can see all

    // Apply filters
    if (teacherId) where.teacherId = teacherId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status as MeetingStatus;

    // Date range filter
    if (startDate || endDate || upcoming) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
      if (upcoming) where.date.gte = new Date();
    }

    const [meetings, total] = await Promise.all([
      prisma.parentMeeting.findMany({
        where,
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
              studentCode: true,
              parentUserId: true,
            },
          },
        },
        orderBy: { date: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.parentMeeting.count({ where }),
    ]);

    return NextResponse.json({
      meetings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + meetings.length < total,
      },
    });
  } catch (error) {
    console.error('Parent meetings GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/parent-meetings - Create a new parent meeting
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, TEACHER, and PARENT can create meetings
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER', 'PARENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = createParentMeetingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { studentId, date, duration, room, parentNotes, teacherNotes } = validation.data;
    let { teacherId } = validation.data;

    // For TEACHER role, get their teacherId from email
    if (session.user.role === 'TEACHER') {
      if (!session.user.email) {
        return NextResponse.json(
          { error: 'Email utente non disponibile' },
          { status: 400 }
        );
      }
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: 'Docente non trovato' },
          { status: 404 }
        );
      }
      teacherId = teacher.id;
    }

    if (!teacherId) {
      return NextResponse.json(
        { error: 'teacherId è obbligatorio' },
        { status: 400 }
      );
    }

    // Verify teacher exists
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        tenantId: session.user.tenantId,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'Docente non trovato' },
        { status: 404 }
      );
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: session.user.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Studente non trovato' },
        { status: 404 }
      );
    }

    // For PARENT, verify they are the parent of this student
    if (session.user.role === 'PARENT') {
      if (student.parentUserId !== session.user.id) {
        return NextResponse.json(
          { error: 'Non autorizzato per questo studente' },
          { status: 403 }
        );
      }
    }

    // Check for conflicting meetings (same teacher, same time slot)
    const meetingEnd = new Date(date.getTime() + duration * 60000);
    const conflictingMeeting = await prisma.parentMeeting.findFirst({
      where: {
        teacherId,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        date: {
          gte: new Date(date.getTime() - duration * 60000),
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

    // Determine initial status based on role
    // PARENT creates REQUESTED, TEACHER/ADMIN creates CONFIRMED
    const initialStatus: MeetingStatus =
      session.user.role === 'PARENT' ? 'REQUESTED' : 'CONFIRMED';

    // Create the meeting
    const meeting = await prisma.parentMeeting.create({
      data: {
        tenantId: session.user.tenantId!,
        teacherId,
        parentId: session.user.role === 'PARENT' ? session.user.id! : student.parentUserId!,
        studentId,
        date,
        duration,
        room,
        status: initialStatus,
        parentNotes: session.user.role === 'PARENT' ? parentNotes : undefined,
        teacherNotes: session.user.role === 'TEACHER' ? teacherNotes : undefined,
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

    // Create notifications
    try {
      if (session.user.role === 'PARENT') {
        // Notify teacher about new meeting request
        if (teacher.email) {
          const teacherUser = await prisma.user.findFirst({
            where: { email: teacher.email },
          });
          if (teacherUser) {
            await prisma.notification.create({
              data: {
                tenantId: session.user.tenantId!,
                userId: teacherUser.id,
                title: 'Nuova richiesta di colloquio',
                content: `Richiesta di colloquio per ${student.firstName} ${student.lastName} il ${date.toLocaleDateString('it-IT')} alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
                type: 'MEETING',
                priority: 'NORMAL',
                sourceType: 'parentMeeting',
                sourceId: meeting.id,
                actionUrl: `/dashboard/meetings/${meeting.id}`,
              },
            });
          }
        }
      } else if (initialStatus === 'CONFIRMED' && student.parentUserId) {
        // Notify parent about confirmed meeting
        await prisma.notification.create({
          data: {
            tenantId: session.user.tenantId!,
            userId: student.parentUserId,
            title: 'Colloquio confermato',
            content: `Colloquio con ${teacher.firstName} ${teacher.lastName} per ${student.firstName} il ${date.toLocaleDateString('it-IT')} alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
            type: 'MEETING',
            priority: 'HIGH',
            sourceType: 'parentMeeting',
            sourceId: meeting.id,
            actionUrl: `/dashboard/meetings/${meeting.id}`,
          },
        });
      }
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Parent meeting POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
