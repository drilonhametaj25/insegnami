import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { DisciplinaryType, Severity } from '@prisma/client';

// Validation schema for update
const updateSchema = z.object({
  type: z.nativeEnum(DisciplinaryType).optional(),
  severity: z.nativeEnum(Severity).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  date: z.string().transform((val) => new Date(val)).optional(),
  resolved: z.boolean().optional(),
  resolution: z.string().nullable().optional(),
});

// GET /api/disciplinary-notes/[id] - Get a single disciplinary note
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

    const note = await prisma.disciplinaryNote.findFirst({
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
    });

    if (!note) {
      return NextResponse.json(
        { error: 'Nota disciplinare non trovata' },
        { status: 404 }
      );
    }

    // Check access for students/parents
    if (session.user.role === 'PARENT') {
      const children = await prisma.student.findMany({
        where: {
          parentUserId: session.user.id,
          tenantId: session.user.tenantId,
        },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (!childIds.includes(note.studentId)) {
        return NextResponse.json(
          { error: 'Nota disciplinare non trovata' },
          { status: 404 }
        );
      }
    } else if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      });
      if (!student || student.id !== note.studentId) {
        return NextResponse.json(
          { error: 'Nota disciplinare non trovata' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Disciplinary note GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/disciplinary-notes/[id] - Update a disciplinary note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can update disciplinary notes
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSchema.parse(body);

    // Check if note exists and belongs to tenant
    const existingNote = await prisma.disciplinaryNote.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existingNote) {
      return NextResponse.json(
        { error: 'Nota disciplinare non trovata' },
        { status: 404 }
      );
    }

    // If teacher, verify they created this note
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher && existingNote.teacherId !== teacher.id) {
        return NextResponse.json(
          { error: 'Non puoi modificare note inserite da altri docenti' },
          { status: 403 }
        );
      }
    }

    // Handle resolution
    const updateData: any = { ...validatedData };
    if (validatedData.resolved === true && !existingNote.resolved) {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = session.user.id;
    } else if (validatedData.resolved === false) {
      updateData.resolvedAt = null;
      updateData.resolvedBy = null;
      updateData.resolution = null;
    }

    // Update the note
    const updatedNote = await prisma.disciplinaryNote.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
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
      },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Disciplinary note PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE /api/disciplinary-notes/[id] - Delete a disciplinary note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can delete disciplinary notes
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if note exists and belongs to tenant
    const note = await prisma.disciplinaryNote.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!note) {
      return NextResponse.json(
        { error: 'Nota disciplinare non trovata' },
        { status: 404 }
      );
    }

    await prisma.disciplinaryNote.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Nota disciplinare eliminata',
    });
  } catch (error) {
    console.error('Disciplinary note DELETE error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
