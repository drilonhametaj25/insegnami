import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      classId, 
      teacherId, 
      startTime, 
      endTime, 
      room,
      recurrence 
    } = body;

    // Validazione input
    if (!title || !classId || !teacherId || !startTime || !endTime || !recurrence) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti' },
        { status: 400 }
      );
    }

    // Get user's tenant
    const userTenant = await prisma.userTenant.findFirst({
      where: { userId: session.user.id }
    });

    if (!userTenant) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    // Verify class and teacher exist and belong to tenant
    const [classExists, teacherExists] = await Promise.all([
      prisma.class.findFirst({
        where: { id: classId, tenantId: userTenant.tenantId }
      }),
      prisma.teacher.findFirst({
        where: { id: teacherId, tenantId: userTenant.tenantId }
      })
    ]);

    if (!classExists || !teacherExists) {
      return NextResponse.json(
        { error: 'Classe o docente non trovato' },
        { status: 404 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const lessonDuration = endDate.getTime() - startDate.getTime();

    // Generate recurring lesson dates
    const lessons = [];
    let currentDate = new Date(startDate);
    const maxOccurrences = recurrence.occurrences || 52; // max 52 settimane
    const endRecurrenceDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
    
    let occurrenceCount = 0;

    while (occurrenceCount < maxOccurrences) {
      // Check if we've reached the end date
      if (endRecurrenceDate && currentDate > endRecurrenceDate) {
        break;
      }

      // For weekly recurrence, check if current day is in allowed weekdays
      if (recurrence.frequency === 'weekly' && recurrence.weekdays) {
        const dayOfWeek = currentDate.getDay();
        if (!recurrence.weekdays.includes(dayOfWeek)) {
          // Move to next day and continue
          currentDate.setDate(currentDate.getDate() + 1);
          if (currentDate.getDay() === startDate.getDay()) {
            // We've cycled through a week, increment occurrence count
            occurrenceCount++;
          }
          continue;
        }
      }

      const lessonStartTime = new Date(currentDate);
      const lessonEndTime = new Date(currentDate.getTime() + lessonDuration);

      lessons.push({
        tenantId: userTenant.tenantId,
        classId,
        teacherId,
        title,
        description,
        startTime: lessonStartTime,
        endTime: lessonEndTime,
        room,
        isRecurring: true,
        status: 'SCHEDULED' as const,
      });

      // Move to next occurrence
      if (recurrence.frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + (7 * recurrence.interval));
      } else if (recurrence.frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + recurrence.interval);
      }

      occurrenceCount++;
    }

    if (lessons.length === 0) {
      return NextResponse.json(
        { error: 'Nessuna lezione generata con i parametri forniti' },
        { status: 400 }
      );
    }

    // Create parent lesson (template)
    const parentLesson = await prisma.lesson.create({
      data: {
        tenantId: userTenant.tenantId,
        classId,
        teacherId,
        title: `${title} (Serie)`,
        description: `Serie ricorrente - ${description || ''}`,
        startTime: startDate,
        endTime: endDate,
        room,
        isRecurring: true,
        status: 'SCHEDULED',
        recurrenceRule: JSON.stringify(recurrence),
      },
      include: {
        class: {
          include: {
            course: true
          }
        },
        teacher: true
      }
    });

    // Create all lesson occurrences
    const createdLessons = await prisma.lesson.createMany({
      data: lessons.map(lesson => ({
        ...lesson,
        parentLessonId: parentLesson.id,
        recurrenceRule: JSON.stringify(recurrence),
      }))
    });

    // Fetch the created lessons with includes for response
    const allLessons = await prisma.lesson.findMany({
      where: {
        OR: [
          { id: parentLesson.id },
          { parentLessonId: parentLesson.id }
        ]
      },
      include: {
        class: {
          include: {
            course: true
          }
        },
        teacher: true
      }
    });

    return NextResponse.json(allLessons, { status: 201 });

  } catch (error) {
    console.error('Errore nella creazione lezioni ricorrenti:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
