import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { GradeType } from '@prisma/client';

// Validation schema for update
const gradeUpdateSchema = z.object({
  value: z.number().min(0).max(10).optional(),
  valueText: z.string().optional().nullable(),
  weight: z.number().min(0).max(5).optional(),
  type: z.nativeEnum(GradeType).optional(),
  description: z.string().optional().nullable(),
  date: z.string().transform((val) => new Date(val)).optional(),
  isVisible: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  periodId: z.string().optional().nullable(),
});

// GET /api/grades/[id] - Get a single grade
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

    const grade = await prisma.grade.findFirst({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
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
          },
        },
      },
    });

    if (!grade) {
      return NextResponse.json({ error: 'Voto non trovato' }, { status: 404 });
    }

    // Check visibility for students/parents
    if (['STUDENT', 'PARENT'].includes(session.user.role) && !grade.isVisible) {
      return NextResponse.json({ error: 'Voto non trovato' }, { status: 404 });
    }

    return NextResponse.json(grade);
  } catch (error) {
    console.error('Grade GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/grades/[id] - Update a grade
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can update grades
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = gradeUpdateSchema.parse(body);

    // Check if grade exists and belongs to tenant
    const existingGrade = await prisma.grade.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingGrade) {
      return NextResponse.json({ error: 'Voto non trovato' }, { status: 404 });
    }

    // If teacher, verify they created this grade or have permission
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && existingGrade.teacherId !== teacher.id) {
        return NextResponse.json(
          { error: 'Non puoi modificare voti inseriti da altri docenti' },
          { status: 403 }
        );
      }
    }

    // Update the grade
    const updatedGrade = await prisma.grade.update({
      where: { id },
      data: validatedData,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
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
          },
        },
      },
    });

    return NextResponse.json(updatedGrade);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Grade PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/grades/[id] - Delete a grade
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can delete grades
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if grade exists and belongs to tenant
    const grade = await prisma.grade.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!grade) {
      return NextResponse.json({ error: 'Voto non trovato' }, { status: 404 });
    }

    // If teacher, verify they created this grade
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && grade.teacherId !== teacher.id) {
        return NextResponse.json(
          { error: 'Non puoi eliminare voti inseriti da altri docenti' },
          { status: 403 }
        );
      }
    }

    await prisma.grade.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Voto eliminato',
    });
  } catch (error) {
    console.error('Grade DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
