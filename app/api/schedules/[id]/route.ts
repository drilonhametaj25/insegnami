import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema for schedule update
const scheduleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  config: z.object({
    hardConstraints: z.object({
      noTeacherOverlap: z.boolean(),
      noClassOverlap: z.boolean(),
      noRoomOverlap: z.boolean(),
      respectWeeklyHours: z.boolean(),
    }).partial().optional(),
    softConstraints: z.object({
      difficultSubjectsInMorning: z.number().min(0).max(10),
      noGaps: z.number().min(0).max(10),
      balancedDistribution: z.number().min(0).max(10),
      maxConsecutiveSameSubject: z.number().min(0).max(10),
      lunchBreakPreference: z.number().min(0).max(10),
      teacherLoadBalance: z.number().min(0).max(10),
    }).partial().optional(),
    algorithmParams: z.object({
      maxIterations: z.number(),
      optimizationRounds: z.number(),
      timeout: z.number(),
    }).partial().optional(),
  }).optional(),
  status: z.enum(['DRAFT', 'ARCHIVED']).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Dettaglio orario con tutti gli slot
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = await params;

    const schedule = await prisma.schedule.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        slots: {
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
          orderBy: [
            { dayOfWeek: 'asc' },
            { slotNumber: 'asc' },
            { classId: 'asc' },
          ],
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Orario non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT: Aggiorna orario
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!['ADMIN', 'DIRECTOR', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = scheduleUpdateSchema.parse(body);

    // Verifica esistenza
    const existing = await prisma.schedule.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Orario non trovato' },
        { status: 404 }
      );
    }

    // Non permettere modifiche se già applicato
    if (existing.status === 'APPLIED' && validatedData.status !== 'ARCHIVED') {
      return NextResponse.json(
        { error: 'Non è possibile modificare un orario già applicato' },
        { status: 400 }
      );
    }

    // Prepara i dati di update
    const updateData: any = {};

    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.startDate) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate) updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.status) updateData.status = validatedData.status;

    if (validatedData.config) {
      const currentConfig = existing.config as any;
      updateData.config = {
        ...currentConfig,
        ...validatedData.config,
        hardConstraints: {
          ...currentConfig?.hardConstraints,
          ...validatedData.config?.hardConstraints,
        },
        softConstraints: {
          ...currentConfig?.softConstraints,
          ...validatedData.config?.softConstraints,
        },
        algorithmParams: {
          ...currentConfig?.algorithmParams,
          ...validatedData.config?.algorithmParams,
        },
      };
    }

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        _count: {
          select: {
            slots: true,
          },
        },
      },
    });

    return NextResponse.json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// DELETE: Elimina orario
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!['ADMIN', 'DIRECTOR', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Verifica esistenza
    const existing = await prisma.schedule.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Orario non trovato' },
        { status: 404 }
      );
    }

    // Non permettere eliminazione se già applicato
    if (existing.status === 'APPLIED') {
      return NextResponse.json(
        { error: 'Non è possibile eliminare un orario già applicato. Archivialo invece.' },
        { status: 400 }
      );
    }

    // Elimina orario (cascade elimina anche gli slot)
    await prisma.schedule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
