import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, getTeacherIdForUser } from '@/lib/api-auth';

// GET /api/grades/class/[classId]/subject/[subjectId] - Get grade grid for class/subject
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; subjectId: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'],
    });

    // Deny-by-default: TEACHER senza profilo risolvibile non accede alla griglia
    let teacherId: string | null = null;
    if (ctx.role === 'TEACHER') {
      teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { classId, subjectId } = await params;
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');

    // Verify class exists
    const classEntity = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(!ctx.isSuperAdmin ? { tenantId: ctx.tenantId } : {}),
      },
      include: {
        course: true,
        teacher: true,
      },
    });

    if (!classEntity) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // TEACHER: solo il titolare della classe può leggere la griglia
    if (ctx.role === 'TEACHER' && classEntity.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify subject exists
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        tenantId: classEntity.tenantId,
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
    }

    // Get all students in the class
    const studentClasses = await prisma.studentClass.findMany({
      where: {
        classId,
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
      },
      orderBy: {
        student: { lastName: 'asc' },
      },
    });

    const students = studentClasses.map((sc) => sc.student);

    // Build where clause for grades
    const where: any = {
      classId,
      subjectId,
      tenantId: classEntity.tenantId,
    };

    if (periodId) {
      where.periodId = periodId;
    }

    // Get all grades for this class/subject
    const grades = await prisma.grade.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Organize grades by student
    const studentGradesMap: Record<string, any[]> = {};
    for (const student of students) {
      studentGradesMap[student.id] = [];
    }

    for (const grade of grades) {
      if (studentGradesMap[grade.studentId]) {
        studentGradesMap[grade.studentId].push(grade);
      }
    }

    // Calculate averages for each student
    const studentsWithGrades = students.map((student) => {
      const studentGrades = studentGradesMap[student.id] || [];

      // Calculate weighted average
      let totalWeightedValue = 0;
      let totalWeight = 0;

      for (const grade of studentGrades) {
        const value = Number(grade.value);
        const weight = Number(grade.weight);
        totalWeightedValue += value * weight;
        totalWeight += weight;
      }

      const average = totalWeight > 0 ? Math.round((totalWeightedValue / totalWeight) * 100) / 100 : null;

      return {
        ...student,
        grades: studentGrades,
        gradeCount: studentGrades.length,
        average,
      };
    });

    // Get unique dates for column headers
    const uniqueDates = [...new Set(grades.map((g) => g.date.toISOString().split('T')[0]))].sort();

    // Calculate class statistics
    const validAverages = studentsWithGrades.filter((s) => s.average !== null).map((s) => s.average as number);
    const classAverage = validAverages.length > 0
      ? Math.round((validAverages.reduce((sum, a) => sum + a, 0) / validAverages.length) * 100) / 100
      : null;

    const insufficientiCount = validAverages.filter((a) => a < 6).length;
    const sufficientiCount = validAverages.filter((a) => a >= 6 && a < 7).length;
    const buoniCount = validAverages.filter((a) => a >= 7 && a < 8).length;
    const ottimiCount = validAverages.filter((a) => a >= 8).length;

    return NextResponse.json({
      class: {
        id: classEntity.id,
        name: classEntity.name,
        code: classEntity.code,
        course: classEntity.course,
      },
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        color: subject.color,
      },
      students: studentsWithGrades,
      dates: uniqueDates,
      statistics: {
        totalStudents: students.length,
        studentsWithGrades: validAverages.length,
        classAverage,
        distribution: {
          insufficienti: insufficientiCount,
          sufficienti: sufficientiCount,
          buoni: buoniCount,
          ottimi: ottimiCount,
        },
      },
    });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Class grades GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
