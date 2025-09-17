import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: classId } = await params;
    const { studentIds } = await request.json();

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: 'studentIds richiesto (array di ID studenti)' },
        { status: 400 }
      );
    }

    // Verify class exists and belongs to tenant
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        tenantId
      }
    });

    if (!classRecord) {
      return NextResponse.json(
        { error: 'Classe non trovata' },
        { status: 404 }
      );
    }

    // Find existing active enrollments
    const existingEnrollments = await prisma.studentClass.findMany({
      where: {
        studentId: { in: studentIds },
        classId: classId,
        isActive: true
      }
    });

    if (existingEnrollments.length === 0) {
      return NextResponse.json(
        { error: 'Nessuno degli studenti specificati è iscritto a questa classe' },
        { status: 400 }
      );
    }

    // Deactivate enrollments (soft delete)
    const result = await prisma.studentClass.updateMany({
      where: {
        id: { in: existingEnrollments.map(e => e.id) }
      },
      data: {
        isActive: false,
        droppedAt: new Date()
      }
    });

    logger.info('Students unenrolled from class', {
      tenantId,
      classId,
      unenrolledStudents: result.count,
      performedBy: user.id
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} studenti rimossi dalla classe`,
      unenrolledStudents: result.count
    });

  } catch (error) {
    logger.error('Error unenrolling students from class:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
