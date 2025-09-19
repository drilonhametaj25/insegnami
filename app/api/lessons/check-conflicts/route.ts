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
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const teacherId = searchParams.get('teacherId');
    const room = searchParams.get('room');
    const excludeLessonId = searchParams.get('excludeLessonId');

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime e endTime sono obbligatori' },
        { status: 400 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Date non valide' },
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

    // Build conflict query conditions
    const whereConditions: any = {
      tenantId: userTenant.tenantId,
      status: { not: 'CANCELLED' },
      // Time overlap check: (start1 < end2) AND (end1 > start2)
      AND: [
        { startTime: { lt: endDate } },
        { endTime: { gt: startDate } }
      ]
    };

    // Exclude current lesson if updating
    if (excludeLessonId) {
      whereConditions.id = { not: excludeLessonId };
    }

    // Check teacher conflicts
    const teacherConflicts: any[] = [];
    if (teacherId) {
      const conflicts = await prisma.lesson.findMany({
        where: {
          ...whereConditions,
          teacherId: teacherId,
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
      teacherConflicts.push(...conflicts);
    }

    // Check room conflicts
    const roomConflicts: any[] = [];
    if (room) {
      const conflicts = await prisma.lesson.findMany({
        where: {
          ...whereConditions,
          room: room,
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
      roomConflicts.push(...conflicts);
    }

    // Combine and deduplicate conflicts
    const allConflicts = [...teacherConflicts, ...roomConflicts];
    const uniqueConflicts = allConflicts.filter((conflict, index, self) =>
      index === self.findIndex(c => c.id === conflict.id)
    );

    const conflicts = uniqueConflicts.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      startTime: lesson.startTime.toISOString(),
      endTime: lesson.endTime.toISOString(),
      room: lesson.room,
      teacher: `${lesson.teacher.firstName} ${lesson.teacher.lastName}`,
      class: `${lesson.class.course.name} - ${lesson.class.name}`,
      conflictType: teacherConflicts.some(c => c.id === lesson.id) 
        ? (roomConflicts.some(c => c.id === lesson.id) ? 'both' : 'teacher')
        : 'room'
    }));

    return NextResponse.json({
      hasConflict: conflicts.length > 0,
      conflicts
    });

  } catch (error) {
    console.error('Errore nel controllo conflitti:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
