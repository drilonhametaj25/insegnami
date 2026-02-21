import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateReportCardSchema = z.object({
  overallComment: z.string().optional(),
  behaviorGrade: z.string().optional(),
});

// GET /api/report-cards/[id] - Get single report card with details
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

    const reportCard = await prisma.reportCard.findFirst({
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
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            dateOfBirth: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            course: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        period: {
          select: {
            id: true,
            name: true,
            type: true,
            startDate: true,
            endDate: true,
            academicYear: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        entries: {
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
            subject: { name: 'asc' },
          },
        },
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Pagella non trovata' }, { status: 404 });
    }

    // Access control
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
    } else if (session.user.role === 'TEACHER' && session.user.email) {
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
    }

    return NextResponse.json(reportCard);
  } catch (error) {
    console.error('Report card GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/report-cards/[id] - Update report card (only DRAFT status)
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
    const validation = updateReportCardSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updated = await prisma.reportCard.update({
      where: { id },
      data: validation.data,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        period: {
          select: {
            id: true,
            name: true,
            type: true,
            academicYear: {
              select: { name: true },
            },
          },
        },
        entries: {
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
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Report card PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/report-cards/[id] - Delete report card (only DRAFT status)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can delete
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Pagella non trovata' }, { status: 404 });
    }

    // Only DRAFT can be deleted
    if (reportCard.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo le pagelle in bozza possono essere eliminate' },
        { status: 400 }
      );
    }

    // Delete entries first (cascade should handle this, but be explicit)
    await prisma.reportCardEntry.deleteMany({
      where: { reportCardId: id },
    });

    await prisma.reportCard.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report card DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
