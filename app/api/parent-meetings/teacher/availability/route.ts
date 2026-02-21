import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Default availability settings (can be made configurable per teacher later)
const DEFAULT_AVAILABILITY = {
  startHour: 14, // 14:00
  endHour: 18, // 18:00
  slotDuration: 15, // minutes
  // Days available: Monday to Friday (1-5)
  availableDays: [1, 2, 3, 4, 5],
};

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  meetingId?: string;
}

// GET /api/parent-meetings/teacher/availability - Get available time slots for a teacher
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const dateStr = searchParams.get('date');
    const weekStr = searchParams.get('week'); // For getting a whole week

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
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'Docente non trovato' },
        { status: 404 }
      );
    }

    // Determine the date range
    let startDate: Date;
    let endDate: Date;

    if (weekStr) {
      // Get slots for a whole week starting from the given date
      startDate = new Date(weekStr);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    } else if (dateStr) {
      // Get slots for a specific day
      startDate = new Date(dateStr);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      // Default: get slots for the next 7 days
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    }

    // Get existing meetings for this teacher in the date range
    const existingMeetings = await prisma.parentMeeting.findMany({
      where: {
        teacherId,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        id: true,
        date: true,
        duration: true,
      },
      orderBy: { date: 'asc' },
    });

    // Generate time slots
    const slots: Record<string, TimeSlot[]> = {};
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();

      // Skip weekends (0 = Sunday, 6 = Saturday) unless configured otherwise
      if (DEFAULT_AVAILABILITY.availableDays.includes(dayOfWeek)) {
        const dateKey = currentDate.toISOString().split('T')[0];
        slots[dateKey] = [];

        // Generate slots for this day
        for (let hour = DEFAULT_AVAILABILITY.startHour; hour < DEFAULT_AVAILABILITY.endHour; hour++) {
          for (let minute = 0; minute < 60; minute += DEFAULT_AVAILABILITY.slotDuration) {
            const slotStart = new Date(currentDate);
            slotStart.setHours(hour, minute, 0, 0);

            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + DEFAULT_AVAILABILITY.slotDuration);

            // Skip slots in the past
            if (slotStart < new Date()) {
              continue;
            }

            // Check if slot conflicts with existing meeting
            const conflictingMeeting = existingMeetings.find((m) => {
              const meetingStart = new Date(m.date);
              const meetingEnd = new Date(meetingStart.getTime() + m.duration * 60000);

              // Check for any overlap
              return slotStart < meetingEnd && slotEnd > meetingStart;
            });

            slots[dateKey].push({
              startTime: slotStart.toISOString(),
              endTime: slotEnd.toISOString(),
              isAvailable: !conflictingMeeting,
              ...(conflictingMeeting && { meetingId: conflictingMeeting.id }),
            });
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
      },
      availability: DEFAULT_AVAILABILITY,
      slots,
    });
  } catch (error) {
    console.error('Teacher availability GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
