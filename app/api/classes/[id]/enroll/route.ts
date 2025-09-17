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
      },
      include: {
        _count: {
          select: {
            students: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!classRecord) {
      return NextResponse.json(
        { error: 'Classe non trovata' },
        { status: 404 }
      );
    }

    // Check capacity
    const currentEnrollments = classRecord._count.students;
    const availableCapacity = classRecord.maxStudents - currentEnrollments;
    
    if (studentIds.length > availableCapacity) {
      return NextResponse.json(
        { 
          error: `Capacità insufficiente. Posti disponibili: ${availableCapacity}, studenti da iscrivere: ${studentIds.length}`,
          availableCapacity,
          requestedEnrollments: studentIds.length
        },
        { status: 400 }
      );
    }

    // Verify all students exist and belong to tenant
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId
      }
    });

    if (students.length !== studentIds.length) {
      const foundIds = students.map(s => s.id);
      const notFoundIds = studentIds.filter(id => !foundIds.includes(id));
      
      return NextResponse.json(
        { 
          error: `Alcuni studenti non sono stati trovati: ${notFoundIds.join(', ')}`,
          notFoundIds
        },
        { status: 400 }
      );
    }

    // Check for existing enrollments
    const existingEnrollments = await prisma.studentClass.findMany({
      where: {
        studentId: { in: studentIds },
        classId: classId
      }
    });

    const existingStudentIds = existingEnrollments.map(e => e.studentId);
    const newStudentIds = studentIds.filter(id => !existingStudentIds.includes(id));

    if (newStudentIds.length === 0) {
      return NextResponse.json(
        { error: 'Tutti gli studenti sono già iscritti a questa classe' },
        { status: 400 }
      );
    }

    // Reactivate existing enrollments that were inactive
    const inactiveEnrollments = existingEnrollments.filter(e => !e.isActive);
    if (inactiveEnrollments.length > 0) {
      await prisma.studentClass.updateMany({
        where: {
          id: { in: inactiveEnrollments.map(e => e.id) }
        },
        data: {
          isActive: true,
          enrolledAt: new Date() // Update enrollment date
        }
      });
    }

    // Create new enrollments
    if (newStudentIds.length > 0) {
      await prisma.studentClass.createMany({
        data: newStudentIds.map(studentId => ({
          studentId,
          classId,
          enrolledAt: new Date(),
          isActive: true
        }))
      });
    }

    const totalEnrolled = newStudentIds.length + inactiveEnrollments.length;

    logger.info('Students enrolled in class', {
      tenantId,
      classId,
      enrolledStudents: totalEnrolled,
      newEnrollments: newStudentIds.length,
      reactivatedEnrollments: inactiveEnrollments.length,
      performedBy: user.id
    });

    return NextResponse.json({
      success: true,
      message: `${totalEnrolled} studenti iscritti alla classe`,
      enrolledStudents: totalEnrolled,
      newEnrollments: newStudentIds.length,
      reactivatedEnrollments: inactiveEnrollments.length
    });

  } catch (error) {
    logger.error('Error enrolling students in class:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
