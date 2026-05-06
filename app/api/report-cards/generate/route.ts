import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getPublicErrorMessage } from '@/lib/api-middleware';
import { calcSubjectAverages, calcBehaviorGrade, type GradeInput } from '@/lib/grades/avg-italian';

const generateSchema = z.object({
  classId: z.string().min(1),
  periodId: z.string().min(1),
});

// POST /api/report-cards/generate - Generate report cards for an entire class
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can generate report cards
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { classId, periodId } = validation.data;

    // Verify class exists
    const classEntity = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!classEntity) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // Verify period exists
    const period = await prisma.academicPeriod.findFirst({
      where: {
        id: periodId,
        academicYear: {
          tenantId: classEntity.tenantId,
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Periodo non trovato' }, { status: 404 });
    }

    // Get all students in the class
    const studentClasses = await prisma.studentClass.findMany({
      where: {
        classId,
        isActive: true,
      },
      include: {
        student: true,
      },
    });

    if (studentClasses.length === 0) {
      return NextResponse.json(
        { error: 'Nessuno studente trovato nella classe' },
        { status: 400 }
      );
    }

    // Get all subjects for this class
    const classSubjects = await prisma.classSubject.findMany({
      where: { classId },
      include: { subject: true },
    });

    if (classSubjects.length === 0) {
      return NextResponse.json(
        { error: 'Nessuna materia associata alla classe' },
        { status: 400 }
      );
    }

    // Get all grades for this class/period
    const grades = await prisma.grade.findMany({
      where: {
        classId,
        periodId,
      },
    });

    // Group grades by student → subject → array of GradeInput.
    // The averaging math (per-channel + weighted overall + behavior) lives
    // in lib/grades/avg-italian.ts so it can be reused by PDF/scrutinio code
    // and unit-tested in isolation.
    const gradesByStudentSubject: Record<string, Record<string, GradeInput[]>> = {};
    const behaviorByStudent: Record<string, GradeInput[]> = {};

    for (const grade of grades) {
      const value = Number(grade.value);
      const weight = Number(grade.weight) || 1;
      const item: GradeInput = { type: grade.type, value, weight };

      if (grade.type === 'BEHAVIOR') {
        if (!behaviorByStudent[grade.studentId]) behaviorByStudent[grade.studentId] = [];
        behaviorByStudent[grade.studentId].push(item);
        continue;
      }

      if (!gradesByStudentSubject[grade.studentId]) {
        gradesByStudentSubject[grade.studentId] = {};
      }
      if (!gradesByStudentSubject[grade.studentId][grade.subjectId]) {
        gradesByStudentSubject[grade.studentId][grade.subjectId] = [];
      }
      gradesByStudentSubject[grade.studentId][grade.subjectId].push(item);
    }

    // Create report cards for each student
    const results = {
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as { studentId: string; studentName: string; status: string; error?: string }[],
    };

    for (const sc of studentClasses) {
      const student = sc.student;

      try {
        // Check if report card already exists
        const existing = await prisma.reportCard.findFirst({
          where: {
            studentId: student.id,
            classId,
            periodId,
          },
        });

        if (existing) {
          results.skipped++;
          results.details.push({
            studentId: student.id,
            studentName: `${student.lastName} ${student.firstName}`,
            status: 'skipped',
            error: 'Pagella già esistente',
          });
          continue;
        }

        // Get grades for this student
        const studentGrades = gradesByStudentSubject[student.id] || {};
        const behaviorGradeNum = calcBehaviorGrade(behaviorByStudent[student.id] ?? []);

        // Create report card with entries
        await prisma.reportCard.create({
          data: {
            tenantId: classEntity.tenantId,
            studentId: student.id,
            classId,
            periodId,
            status: 'DRAFT',
            behaviorGrade: behaviorGradeNum != null ? String(behaviorGradeNum) : null,
            entries: {
              create: classSubjects.map((cs) => {
                const subjectGrades = studentGrades[cs.subjectId] ?? [];
                const stats = calcSubjectAverages(subjectGrades);

                return {
                  subjectId: cs.subjectId,
                  finalGrade: stats.finalProposed,
                  averageOral: stats.averageOral,
                  averageWritten: stats.averageWritten,
                  averagePractical: stats.averagePractical,
                  overallAverage: stats.overallAverage,
                };
              }),
            },
          },
        });

        results.created++;
        results.details.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          status: 'created',
        });
      } catch (error) {
        results.errors++;
        // BUG-050 fix: Use generic error message to prevent info disclosure
        results.details.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          status: 'error',
          error: getPublicErrorMessage(error, 'Errore durante la generazione'),
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: studentClasses.length,
        created: results.created,
        skipped: results.skipped,
        errors: results.errors,
      },
      details: results.details,
    });
  } catch (error) {
    console.error('Report cards generate error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
