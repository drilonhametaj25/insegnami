import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for update
const subjectUpdateSchema = z.object({
  name: z.string().min(1, 'Nome materia obbligatorio').optional(),
  code: z.string().min(1, 'Codice materia obbligatorio').max(10, 'Codice massimo 10 caratteri').optional(),
  color: z.string().optional(),
  icon: z.string().optional().nullable(),
  weeklyHours: z.number().int().min(0).max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/subjects/[id] - Get a single subject
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

    const subject = await prisma.subject.findFirst({
      where,
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                teacherCode: true,
              },
            },
          },
        },
        classSubjects: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                code: true,
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
        },
        _count: {
          select: {
            grades: true,
            homework: true,
            classSubjects: true,
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
    }

    // Transform for response
    const transformedSubject = {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      color: subject.color,
      icon: subject.icon,
      weeklyHours: subject.weeklyHours,
      isActive: subject.isActive,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
      teachers: subject.teachers.map((ts) => ({
        id: ts.teacher.id,
        firstName: ts.teacher.firstName,
        lastName: ts.teacher.lastName,
        email: ts.teacher.email,
        teacherCode: ts.teacher.teacherCode,
      })),
      classSubjects: subject.classSubjects.map((cs) => ({
        classId: cs.class.id,
        className: cs.class.name,
        classCode: cs.class.code,
        teacherId: cs.teacher.id,
        teacherName: `${cs.teacher.firstName} ${cs.teacher.lastName}`,
        weeklyHours: cs.weeklyHours,
      })),
      _count: subject._count,
    };

    return NextResponse.json(transformedSubject);
  } catch (error) {
    console.error('Subject GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/subjects/[id] - Update a subject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can update subjects
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = subjectUpdateSchema.parse(body);

    // Check if subject exists and belongs to tenant
    const existingSubject = await prisma.subject.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingSubject) {
      return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
    }

    // Check if new code conflicts with another subject
    if (validatedData.code && validatedData.code !== existingSubject.code) {
      const codeConflict = await prisma.subject.findFirst({
        where: {
          code: validatedData.code,
          tenantId: session.user.tenantId,
          id: { not: id },
        },
      });

      if (codeConflict) {
        return NextResponse.json(
          { error: 'Codice materia già esistente' },
          { status: 400 }
        );
      }
    }

    // Update the subject
    const updatedSubject = await prisma.subject.update({
      where: { id },
      data: validatedData,
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            grades: true,
            homework: true,
            classSubjects: true,
          },
        },
      },
    });

    return NextResponse.json(updatedSubject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Subject PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/subjects/[id] - Delete a subject
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can delete subjects
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if subject exists and belongs to tenant
    const subject = await prisma.subject.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        _count: {
          select: {
            grades: true,
            homework: true,
            classSubjects: true,
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
    }

    // Check if subject has related data
    const hasRelatedData =
      subject._count.grades > 0 ||
      subject._count.homework > 0 ||
      subject._count.classSubjects > 0;

    if (hasRelatedData) {
      // Soft delete: deactivate instead of deleting
      await prisma.subject.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Materia disattivata (ha dati correlati)',
        deactivated: true,
      });
    }

    // Hard delete if no related data
    await prisma.subject.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Materia eliminata',
      deleted: true,
    });
  } catch (error) {
    console.error('Subject DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
