import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admin and superadmin can access teacher stats
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    // Get basic counts
    const [
      totalTeachers,
      activeTeachers,
      inactiveTeachers,
      suspendedTeachers,
      fullTimeTeachers,
      partTimeTeachers,
      contractTeachers
    ] = await Promise.all([
      prisma.teacher.count({
        where: { tenantId }
      }),
      prisma.teacher.count({
        where: { 
          tenantId,
          status: 'ACTIVE'
        }
      }),
      prisma.teacher.count({
        where: { 
          tenantId,
          status: 'INACTIVE'
        }
      }),
      prisma.teacher.count({
        where: { 
          tenantId,
          status: 'SUSPENDED'
        }
      }),
      prisma.teacher.count({
        where: { 
          tenantId,
          contractType: 'Full-time'
        }
      }),
      prisma.teacher.count({
        where: { 
          tenantId,
          contractType: 'Part-time'
        }
      }),
      prisma.teacher.count({
        where: { 
          tenantId,
          contractType: 'Contract'
        }
      })
    ]);

    // Get teachers hired this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const hiredThisMonth = await prisma.teacher.count({
      where: {
        tenantId,
        hireDate: {
          gte: startOfMonth
        }
      }
    });

    // Calculate average tenure (years since hire date)
    const teachers = await prisma.teacher.findMany({
      where: {
        tenantId
      },
      select: {
        hireDate: true
      }
    });

    const currentYear = new Date().getFullYear();
    const averageExperience = teachers.length > 0
      ? teachers.reduce((sum: number, teacher: { hireDate: Date }) => {
          const hireYear = new Date(teacher.hireDate).getFullYear();
          return sum + (currentYear - hireYear);
        }, 0) / teachers.length
      : 0;

    // Get total classes and lessons assigned to teachers
    const [totalClasses, totalLessons] = await Promise.all([
      prisma.class.count({
        where: { 
          tenantId,
          teacherId: {
            not: undefined
          }
        }
      }),
      prisma.lesson.count({
        where: { 
          tenantId,
          teacherId: {
            not: undefined
          }
        }
      })
    ]);

    const stats = {
      total: totalTeachers,
      active: activeTeachers,
      inactive: inactiveTeachers,
      onLeave: suspendedTeachers, // Using suspended as "on leave"
      fullTime: fullTimeTeachers,
      partTime: partTimeTeachers,
      contract: contractTeachers,
      substitute: 0, // Not tracked in current schema
      hiredThisMonth,
      averageExperience: Math.round(averageExperience * 10) / 10,
      totalClasses,
      totalLessons
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Teacher stats error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
