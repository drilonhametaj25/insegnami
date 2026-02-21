import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

interface GradeWithRelations {
  id: string;
  value: Decimal;
  weight: Decimal;
  type: string;
  date: Date;
  description: string | null;
  subject: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  };
}

interface SubjectAverage {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string | null;
  grades: GradeWithRelations[];
  averages: {
    overall: number;
    oral: number;
    written: number;
    practical: number;
    gradeCount: number;
  };
}

// GET /api/grades/student/[id] - Get all grades for a student with averages by subject
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');
    const classId = searchParams.get('classId');

    // Verify student exists and check access
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Studente non trovato' }, { status: 404 });
    }

    // Check access rights
    if (session.user.role === 'STUDENT') {
      if (student.userId !== session.user.id) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    } else if (session.user.role === 'PARENT') {
      if (student.parentUserId !== session.user.id) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    }

    // Build where clause
    const where: any = {
      studentId,
      tenantId: student.tenantId,
    };

    // Only show visible grades to students/parents
    if (['STUDENT', 'PARENT'].includes(session.user.role)) {
      where.isVisible = true;
    }

    if (periodId) where.periodId = periodId;
    if (classId) where.classId = classId;

    // Get all grades
    const grades = await prisma.grade.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
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
        period: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }],
    });

    // Group grades by subject and calculate averages
    const subjectMap = new Map<string, SubjectAverage>();

    for (const grade of grades) {
      const subjectId = grade.subject.id;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName: grade.subject.name,
          subjectCode: grade.subject.code,
          subjectColor: grade.subject.color,
          grades: [],
          averages: {
            overall: 0,
            oral: 0,
            written: 0,
            practical: 0,
            gradeCount: 0,
          },
        });
      }

      subjectMap.get(subjectId)!.grades.push(grade);
    }

    // Calculate weighted averages for each subject
    for (const [, subject] of subjectMap) {
      const { grades } = subject;

      // Calculate weighted average
      let totalWeightedValue = 0;
      let totalWeight = 0;

      const oralGrades: { value: number; weight: number }[] = [];
      const writtenGrades: { value: number; weight: number }[] = [];
      const practicalGrades: { value: number; weight: number }[] = [];

      for (const grade of grades) {
        const value = Number(grade.value);
        const weight = Number(grade.weight);

        totalWeightedValue += value * weight;
        totalWeight += weight;

        if (grade.type === 'ORAL') {
          oralGrades.push({ value, weight });
        } else if (grade.type === 'WRITTEN' || grade.type === 'TEST') {
          writtenGrades.push({ value, weight });
        } else if (grade.type === 'PRACTICAL') {
          practicalGrades.push({ value, weight });
        }
      }

      subject.averages.overall = totalWeight > 0 ? Math.round((totalWeightedValue / totalWeight) * 100) / 100 : 0;
      subject.averages.gradeCount = grades.length;

      // Calculate type-specific averages
      if (oralGrades.length > 0) {
        const oralTotal = oralGrades.reduce((sum, g) => sum + g.value * g.weight, 0);
        const oralWeight = oralGrades.reduce((sum, g) => sum + g.weight, 0);
        subject.averages.oral = Math.round((oralTotal / oralWeight) * 100) / 100;
      }

      if (writtenGrades.length > 0) {
        const writtenTotal = writtenGrades.reduce((sum, g) => sum + g.value * g.weight, 0);
        const writtenWeight = writtenGrades.reduce((sum, g) => sum + g.weight, 0);
        subject.averages.written = Math.round((writtenTotal / writtenWeight) * 100) / 100;
      }

      if (practicalGrades.length > 0) {
        const practicalTotal = practicalGrades.reduce((sum, g) => sum + g.value * g.weight, 0);
        const practicalWeight = practicalGrades.reduce((sum, g) => sum + g.weight, 0);
        subject.averages.practical = Math.round((practicalTotal / practicalWeight) * 100) / 100;
      }
    }

    // Calculate overall average across all subjects
    const subjectAverages = Array.from(subjectMap.values());
    const overallAverage = subjectAverages.length > 0
      ? Math.round((subjectAverages.reduce((sum, s) => sum + s.averages.overall, 0) / subjectAverages.length) * 100) / 100
      : 0;

    return NextResponse.json({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentCode: student.studentCode,
      },
      subjectGrades: subjectAverages,
      overallAverage,
      totalGrades: grades.length,
    });
  } catch (error) {
    console.error('Student grades GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
