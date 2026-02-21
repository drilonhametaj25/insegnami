import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateEntriesSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string().optional(),
      subjectId: z.string(),
      finalGrade: z.number().min(1).max(10),
      finalGradeText: z.string().optional(),
      teacherComment: z.string().optional(),
    })
  ),
});

// GET /api/report-cards/[id]/entries - Get entries for a report card
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

    // Verify report card exists and user has access
    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Pagella non trovata' }, { status: 404 });
    }

    // Access control for students/parents
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
      });
      if (!student || student.id !== reportCard.studentId) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
      if (reportCard.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Pagella non ancora pubblicata' }, { status: 403 });
      }
    } else if (session.user.role === 'PARENT') {
      const child = await prisma.student.findFirst({
        where: { parentUserId: session.user.id },
      });
      if (!child || child.id !== reportCard.studentId) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
      if (reportCard.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Pagella non ancora pubblicata' }, { status: 403 });
      }
    }

    const entries = await prisma.reportCardEntry.findMany({
      where: { reportCardId: id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
      },
      orderBy: {
        subjectId: 'asc',
      },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Report card entries GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/report-cards/[id]/entries - Update entries in bulk
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

    // Find report card
    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Pagella non trovata' }, { status: 404 });
    }

    // Only DRAFT can be edited
    if (reportCard.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo le pagelle in bozza possono essere modificate' },
        { status: 400 }
      );
    }

    // Access control
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
        include: { classes: { select: { id: true } } },
      });
      if (!teacher || !teacher.classes.some((c: { id: string }) => c.id === reportCard.classId)) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    } else if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateEntriesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Update each entry
    const updates = await Promise.all(
      validation.data.entries.map(async (entry) => {
        if (entry.id) {
          // Update existing entry
          return prisma.reportCardEntry.update({
            where: { id: entry.id },
            data: {
              finalGrade: entry.finalGrade,
              finalGradeText: entry.finalGradeText,
              teacherComment: entry.teacherComment,
            },
          });
        } else {
          // Update by subjectId (upsert)
          return prisma.reportCardEntry.upsert({
            where: {
              reportCardId_subjectId: {
                reportCardId: id,
                subjectId: entry.subjectId,
              },
            },
            update: {
              finalGrade: entry.finalGrade,
              finalGradeText: entry.finalGradeText,
              teacherComment: entry.teacherComment,
            },
            create: {
              reportCardId: id,
              subjectId: entry.subjectId,
              finalGrade: entry.finalGrade,
              finalGradeText: entry.finalGradeText,
              teacherComment: entry.teacherComment,
            },
          });
        }
      })
    );

    // Fetch updated entries
    const entries = await prisma.reportCardEntry.findMany({
      where: { reportCardId: id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
      },
      orderBy: {
        subjectId: 'asc',
      },
    });

    return NextResponse.json({ entries, updated: updates.length });
  } catch (error) {
    console.error('Report card entries PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
