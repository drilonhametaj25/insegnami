import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updatePackageSchema = z.object({
  totalHours: z.number().min(1).optional(),
  remainingHours: z.number().min(0).optional(),
  expiryDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/hours-packages/[id] - Get a specific hours package
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = await params;

    // Build where clause based on role
    const where: any = { id };

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Students can only view their own packages
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      if (student) {
        where.studentId = student.id;
      }
    }

    const hoursPackage = await prisma.hoursPackage.findFirst({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    if (!hoursPackage) {
      return NextResponse.json(
        { error: 'Pacchetto ore non trovato' },
        { status: 404 }
      );
    }

    // Calculate additional stats
    const totalHours = parseFloat(hoursPackage.totalHours.toString());
    const remainingHours = parseFloat(hoursPackage.remainingHours.toString());
    const usedHours = totalHours - remainingHours;
    const usedPercentage = totalHours > 0
      ? Math.round((usedHours / totalHours) * 100)
      : 0;
    const isLow = remainingHours <= totalHours * 0.2 && remainingHours > 0; // 20% threshold
    const isExpired = hoursPackage.expiryDate && new Date(hoursPackage.expiryDate) < new Date();

    return NextResponse.json({
      ...hoursPackage,
      usedHours,
      usedPercentage,
      isLow,
      isExpired,
    });
  } catch (error) {
    console.error('Error fetching hours package:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/hours-packages/[id] - Update a hours package
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can update hours packages
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updatePackageSchema.parse(body);

    // Verify package exists and belongs to tenant
    const existing = await prisma.hoursPackage.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pacchetto ore non trovato' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (validatedData.totalHours !== undefined) {
      updateData.totalHours = validatedData.totalHours;
    }
    if (validatedData.remainingHours !== undefined) {
      updateData.remainingHours = validatedData.remainingHours;
    }
    if (validatedData.expiryDate !== undefined) {
      updateData.expiryDate = validatedData.expiryDate ? new Date(validatedData.expiryDate) : null;
    }
    if (validatedData.isActive !== undefined) {
      updateData.isActive = validatedData.isActive;
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    // Update the package
    const updated = await prisma.hoursPackage.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    // Calculate stats
    const updatedTotalHours = parseFloat(updated.totalHours.toString());
    const updatedRemainingHours = parseFloat(updated.remainingHours.toString());
    const usedHours = updatedTotalHours - updatedRemainingHours;
    const usedPercentage = updatedTotalHours > 0
      ? Math.round((usedHours / updatedTotalHours) * 100)
      : 0;
    const isLow = updatedRemainingHours <= updatedTotalHours * 0.2 && updatedRemainingHours > 0;

    return NextResponse.json({
      message: 'Pacchetto ore aggiornato con successo',
      hoursPackage: {
        ...updated,
        usedHours,
        usedPercentage,
        isLow,
      },
    });
  } catch (error) {
    console.error('Error updating hours package:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can delete hours packages
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Verify package exists and belongs to tenant
    const hoursPackage = await prisma.hoursPackage.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!hoursPackage) {
      return NextResponse.json(
        { error: 'Pacchetto ore non trovato' },
        { status: 404 }
      );
    }

    // Delete the package
    await prisma.hoursPackage.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Pacchetto ore eliminato con successo' });
  } catch (error) {
    console.error('Error deleting hours package:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
