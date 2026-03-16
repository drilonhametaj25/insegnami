import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/subjects/stats - Get subject statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can view stats
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    // Get all stats in parallel
    const [
      totalSubjects,
      activeSubjects,
      inactiveSubjects,
      subjectsWithTeachers,
      subjectsWithGrades,
      subjectsWithHomework,
      totalGrades,
      totalHomework,
      avgGradesBySubject,
    ] = await Promise.all([
      // Total subjects
      prisma.subject.count({
        where: { tenantId },
      }),
      // Active subjects
      prisma.subject.count({
        where: { tenantId, isActive: true },
      }),
      // Inactive subjects
      prisma.subject.count({
        where: { tenantId, isActive: false },
      }),
      // Subjects with at least one teacher
      prisma.subject.count({
        where: {
          tenantId,
          teachers: { some: {} },
        },
      }),
      // Subjects with at least one grade
      prisma.subject.count({
        where: {
          tenantId,
          grades: { some: {} },
        },
      }),
      // Subjects with at least one homework
      prisma.subject.count({
        where: {
          tenantId,
          homework: { some: {} },
        },
      }),
      // Total grades across all subjects
      prisma.grade.count({
        where: { tenantId },
      }),
      // Total homework across all subjects
      prisma.homework.count({
        where: { tenantId },
      }),
      // Average grades by subject
      prisma.grade.groupBy({
        by: ['subjectId'],
        where: { tenantId },
        _avg: {
          value: true,
        },
        _count: true,
      }),
    ]);

    // Get top subjects by grade count
    const topSubjectsByGrades = await prisma.subject.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        _count: {
          select: {
            grades: true,
          },
        },
      },
      orderBy: {
        grades: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    // Get subjects with weekly hours distribution
    const weeklyHoursDistribution = await prisma.subject.groupBy({
      by: ['weeklyHours'],
      where: { tenantId, weeklyHours: { not: null } },
      _count: true,
    });

    const stats = {
      totalSubjects,
      activeSubjects,
      inactiveSubjects,
      subjectsWithTeachers,
      subjectsWithGrades,
      subjectsWithHomework,
      totalGrades,
      totalHomework,
      avgGradesPerSubject: totalSubjects > 0 ? (totalGrades / totalSubjects).toFixed(1) : 0,
      avgHomeworkPerSubject: totalSubjects > 0 ? (totalHomework / totalSubjects).toFixed(1) : 0,
      topSubjectsByGrades: topSubjectsByGrades.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        color: s.color,
        gradesCount: s._count.grades,
      })),
      weeklyHoursDistribution: weeklyHoursDistribution.map((d) => ({
        hours: d.weeklyHours,
        count: d._count,
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Subject stats error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
