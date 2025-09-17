import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admin and superadmin can perform bulk actions
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const { action, teacherIds } = await request.json();

    if (!action || !teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
      return NextResponse.json(
        { error: 'Azione e ID degli insegnanti richiesti' },
        { status: 400 }
      );
    }

    // Validate that all teachers belong to the current tenant
    const teacherCount = await prisma.teacher.count({
      where: {
        id: { in: teacherIds },
        tenantId
      }
    });

    if (teacherCount !== teacherIds.length) {
      return NextResponse.json(
        { error: 'Alcuni insegnanti non trovati o non autorizzati' },
        { status: 400 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case 'activate':
        updateData = { status: 'ACTIVE' };
        break;
      case 'deactivate':
        updateData = { status: 'INACTIVE' };
        break;
      case 'suspend':
      case 'leave':
        updateData = { status: 'SUSPENDED' };
        break;
      case 'delete':
        // For delete action, we'll handle it separately
        break;
      default:
        return NextResponse.json(
          { error: 'Azione non valida' },
          { status: 400 }
        );
    }

    if (action === 'delete') {
      // Check if any teacher has associated classes or lessons
      const teachersWithClasses = await prisma.teacher.findMany({
        where: {
          id: { in: teacherIds },
          tenantId,
          OR: [
            {
              classes: {
                some: {}
              }
            },
            {
              lessons: {
                some: {}
              }
            }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      });

      if (teachersWithClasses.length > 0) {
        return NextResponse.json(
          { 
            error: 'Impossibile eliminare insegnanti con classi o lezioni assegnate',
            details: teachersWithClasses.map((t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`)
          },
          { status: 400 }
        );
      }

      // Delete teachers
      await prisma.teacher.deleteMany({
        where: {
          id: { in: teacherIds },
          tenantId
        }
      });
    } else {
      // Update teachers
      await prisma.teacher.updateMany({
        where: {
          id: { in: teacherIds },
          tenantId
        },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Azione '${action}' eseguita su ${teacherIds.length} insegnanti`,
      affectedCount: teacherIds.length
    });

  } catch (error) {
    console.error('Teacher bulk action error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
