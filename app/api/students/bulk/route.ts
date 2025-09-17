import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const bulkActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'suspend', 'delete']),
  studentIds: z.array(z.string()).min(1, 'Seleziona almeno uno studente'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can perform bulk actions
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = bulkActionSchema.parse(body);
    const { action, studentIds } = validatedData;

    // Verify all students belong to the same tenant
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: session.user.tenantId,
      },
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        { error: 'Alcuni studenti non sono stati trovati o non appartengono alla tua organizzazione' },
        { status: 404 }
      );
    }

    let result;
    switch (action) {
      case 'activate':
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'deactivate':
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'INACTIVE' },
        });
        break;

      case 'suspend':
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'SUSPENDED' },
        });
        break;

      case 'delete':
        // Soft delete by setting status to INACTIVE
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'INACTIVE' },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Azione non supportata' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Azione '${action}' completata per ${result.count} studenti`,
      count: result.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in bulk student action:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
