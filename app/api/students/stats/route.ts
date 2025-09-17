import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can access stats
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get student statistics
    const [
      totalCount,
      activeCount,
      inactiveCount,
      suspendedCount,
      enrolledThisMonth,
      averageAgeData,
      totalClassEnrollments
    ] = await Promise.all([
      // Total students
      prisma.student.count({
        where: { tenantId },
      }),

      // Active students
      prisma.student.count({
        where: {
          tenantId,
          status: 'ACTIVE',
        },
      }),

      // Inactive students
      prisma.student.count({
        where: {
          tenantId,
          status: 'INACTIVE',
        },
      }),

      // Suspended students
      prisma.student.count({
        where: {
          tenantId,
          status: 'SUSPENDED',
        },
      }),

      // Students enrolled this month
      prisma.student.count({
        where: {
          tenantId,
          enrollmentDate: {
            gte: thisMonth,
          },
        },
      }),

      // Average age calculation
      prisma.student.findMany({
        where: {
          tenantId,
          dateOfBirth: {
            not: undefined,
          },
        },
        select: {
          dateOfBirth: true,
        },
      }),

      // Total class enrollments
      prisma.studentClass.count({
        where: {
          student: {
            tenantId,
          },
        },
      }),
    ]);

    // Calculate average age
    let averageAge = 0;
    if (averageAgeData.length > 0) {
      const ages = averageAgeData.map(student => {
        const birthDate = new Date(student.dateOfBirth!);
        return now.getFullYear() - birthDate.getFullYear();
      });
      averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
    }

    const stats = {
      totalStudents: totalCount,
      activeStudents: activeCount,
      inactiveStudents: inactiveCount,
      newStudentsThisMonth: enrolledThisMonth,
      averageAge: Math.round(averageAge),
      totalClasses: totalClassEnrollments,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
