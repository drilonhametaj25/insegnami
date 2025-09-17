import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    const user = session?.user;
    
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { action, classIds, data } = await request.json();

    if (!action || !classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return NextResponse.json(
        { error: 'Parametri richiesti: action, classIds (array)' },
        { status: 400 }
      );
    }

    // Verify all classes belong to the tenant
    const classCount = await prisma.class.count({
      where: {
        id: { in: classIds },
        tenantId
      }
    });

    if (classCount !== classIds.length) {
      return NextResponse.json(
        { error: 'Alcune classi non sono state trovate o non appartengono al tenant' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'activate':
        result = await prisma.class.updateMany({
          where: {
            id: { in: classIds },
            tenantId
          },
          data: {
            isActive: true,
            updatedAt: new Date()
          }
        });
        break;

      case 'deactivate':
        result = await prisma.class.updateMany({
          where: {
            id: { in: classIds },
            tenantId
          },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });
        break;

      case 'delete':
        // Check if classes have active students or lessons
        const classesWithStudents = await prisma.class.findMany({
          where: {
            id: { in: classIds },
            tenantId
          },
          include: {
            _count: {
              select: {
                students: {
                  where: { isActive: true }
                },
                lessons: true
              }
            }
          }
        });

        const classesWithActiveData = classesWithStudents.filter(
          cls => cls._count.students > 0 || cls._count.lessons > 0
        );

        if (classesWithActiveData.length > 0) {
          return NextResponse.json(
            { 
              error: `Impossibile eliminare ${classesWithActiveData.length} classi con studenti iscritti o lezioni programmate`,
              classesWithData: classesWithActiveData.map(cls => ({
                id: cls.id,
                name: cls.name,
                students: cls._count.students,
                lessons: cls._count.lessons
              }))
            },
            { status: 400 }
          );
        }

        result = await prisma.class.deleteMany({
          where: {
            id: { in: classIds },
            tenantId
          }
        });
        break;

      case 'update':
        if (!data || typeof data !== 'object') {
          return NextResponse.json(
            { error: 'Dati di aggiornamento richiesti per l\'azione update' },
            { status: 400 }
          );
        }

        // Validate update data
        const updateData: any = {
          updatedAt: new Date()
        };

        if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
        if (data.maxStudents !== undefined && Number.isInteger(data.maxStudents) && data.maxStudents > 0) {
          updateData.maxStudents = data.maxStudents;
        }
        if (data.endDate !== undefined) {
          if (data.endDate === null) {
            updateData.endDate = null;
          } else {
            updateData.endDate = new Date(data.endDate);
          }
        }

        result = await prisma.class.updateMany({
          where: {
            id: { in: classIds },
            tenantId
          },
          data: updateData
        });
        break;

      case 'assign_teacher':
        if (!data?.teacherId) {
          return NextResponse.json(
            { error: 'teacherId richiesto per l\'assegnazione insegnante' },
            { status: 400 }
          );
        }

        // Verify teacher exists and belongs to tenant
        const teacher = await prisma.teacher.findFirst({
          where: {
            id: data.teacherId,
            tenantId
          }
        });

        if (!teacher) {
          return NextResponse.json(
            { error: 'Insegnante non trovato' },
            { status: 400 }
          );
        }

        result = await prisma.class.updateMany({
          where: {
            id: { in: classIds },
            tenantId
          },
          data: {
            teacherId: data.teacherId,
            updatedAt: new Date()
          }
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Azione non supportata. Azioni disponibili: activate, deactivate, delete, update, assign_teacher' },
          { status: 400 }
        );
    }

    logger.info('Bulk action performed on classes', {
      tenantId,
      action,
      classIds,
      updatedCount: result.count,
      performedBy: user.id
    });

    return NextResponse.json({
      success: true,
      message: `Azione '${action}' eseguita su ${result.count} classi`,
      updatedCount: result.count
    });

  } catch (error) {
    logger.error('Error performing bulk action on classes:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
