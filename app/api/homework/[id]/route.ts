import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for update
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  dueDate: z.string().transform((val) => new Date(val)).optional(),
  attachments: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});

// GET /api/homework/[id] - Get a single homework with submissions
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

    // Build where clause with tenant scoping
    const where: any = { id };
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    const homework = await prisma.homework.findFirst({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
        submissions: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // Check visibility for students/parents
    if (['STUDENT', 'PARENT'].includes(session.user.role) && !homework.isPublished) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // For students, only show their own submission
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      });
      if (student) {
        homework.submissions = homework.submissions.filter(
          (s) => s.studentId === student.id
        );
      }
    }

    // For parents, only show their children's submissions
    if (session.user.role === 'PARENT') {
      const children = await prisma.student.findMany({
        where: {
          parentUserId: session.user.id,
          tenantId: session.user.tenantId,
        },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      homework.submissions = homework.submissions.filter((s) =>
        childIds.includes(s.studentId)
      );
    }

    return NextResponse.json(homework);
  } catch (error) {
    console.error('Homework GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/homework/[id] - Update homework
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can update homework
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSchema.parse(body);

    // Check if homework exists and belongs to tenant
    const existingHomework = await prisma.homework.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingHomework) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // If teacher, verify they created this homework
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && existingHomework.teacherId !== teacher.id) {
        return NextResponse.json(
          { error: 'Non puoi modificare compiti di altri docenti' },
          { status: 403 }
        );
      }
    }

    // Update the homework
    const updatedHomework = await prisma.homework.update({
      where: { id },
      data: validatedData,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
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

    return NextResponse.json(updatedHomework);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Homework PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/homework/[id] - Delete homework
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can delete homework
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if homework exists and belongs to tenant
    const homework = await prisma.homework.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // If teacher, verify they created this homework
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && homework.teacherId !== teacher.id) {
        return NextResponse.json(
          { error: 'Non puoi eliminare compiti di altri docenti' },
          { status: 403 }
        );
      }
    }

    await prisma.homework.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Compito eliminato',
    });
  } catch (error) {
    console.error('Homework DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
