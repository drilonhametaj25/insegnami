import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/disciplinary-notes/student/[id] - Get all disciplinary notes for a student
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const resolved = searchParams.get('resolved');

    // Verify student exists and check access
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

    // Check role-based access
    if (session.user.role === 'PARENT') {
      if (student.parentUserId !== session.user.id) {
        return NextResponse.json(
          { error: 'Non autorizzato a visualizzare queste note' },
          { status: 403 }
        );
      }
    } else if (session.user.role === 'STUDENT') {
      const studentUser = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      });
      if (!studentUser || studentUser.id !== studentId) {
        return NextResponse.json(
          { error: 'Non autorizzato a visualizzare queste note' },
          { status: 403 }
        );
      }
    }

    // Build where clause
    const where: any = {
      studentId,
      tenantId: session.user.tenantId,
    };

    if (type) where.type = type;
    if (resolved !== null && resolved !== undefined) {
      where.resolved = resolved === 'true';
    }

    // Get notes with statistics
    const [notes, statistics] = await Promise.all([
      prisma.disciplinaryNote.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.disciplinaryNote.groupBy({
        by: ['type'],
        where: {
          studentId,
          tenantId: session.user.tenantId,
        },
        _count: { type: true },
      }),
    ]);

    // Calculate statistics
    const stats = {
      total: notes.length,
      resolved: notes.filter((n) => n.resolved).length,
      unresolved: notes.filter((n) => !n.resolved).length,
      byType: {
        NOTE: 0,
        WARNING: 0,
        SUSPENSION: 0,
        POSITIVE: 0,
      } as Record<string, number>,
      bySeverity: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      } as Record<string, number>,
    };

    // Populate byType
    for (const stat of statistics) {
      stats.byType[stat.type] = stat._count.type;
    }

    // Populate bySeverity
    for (const note of notes) {
      stats.bySeverity[note.severity] = (stats.bySeverity[note.severity] || 0) + 1;
    }

    return NextResponse.json({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentCode: student.studentCode,
      },
      notes,
      statistics: stats,
    });
  } catch (error) {
    console.error('Student disciplinary notes GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
