import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build predefined groups based on existing data
    const groups: any[] = [];

    try {
      // Get all classes the user can access
      let classesWhere: any = {
        tenantId: session.user.tenantId,
      };

      if (session.user.role === 'TEACHER') {
        classesWhere.teacherId = session.user.id;
      }

      const classes = await prisma.class.findMany({
        where: classesWhere,
        include: {
          course: {
            select: {
              name: true,
            },
          },
          students: {
            select: {
              id: true,
            },
          },
        },
      });

      // Add class-based groups
      classes.forEach(classItem => {
        groups.push({
          id: `class_${classItem.id}`,
          name: `Classe ${classItem.name}`,
          description: `Gruppo per la classe ${classItem.name} - ${classItem.course?.name || 'Senza corso'}`,
          type: 'CLASS',
          memberCount: classItem.students.length,
          classId: classItem.id,
          className: classItem.name,
          courseName: classItem.course?.name,
          createdAt: classItem.createdAt,
        });
      });

      // Get all courses
      const courses = await prisma.course.findMany({
        where: {
          tenantId: session.user.tenantId,
        },
        include: {
          classes: {
            include: {
              students: true,
            },
          },
        },
      });

      // Add course-based groups
      courses.forEach(course => {
        const totalStudents = course.classes.reduce((sum: number, cls: any) => sum + cls.students.length, 0);
        groups.push({
          id: `course_${course.id}`,
          name: `Corso ${course.name}`,
          description: `Gruppo per tutti gli studenti del corso ${course.name}`,
          type: 'COURSE',
          memberCount: totalStudents,
          courseId: course.id,
          courseName: course.name,
          createdAt: course.createdAt,
        });
      });

      // Add role-based groups if user is admin
      if (['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
        const [teachersCount, studentsCount, parentsCount] = await Promise.all([
          prisma.userTenant.count({
            where: {
              tenantId: session.user.tenantId,
              role: 'TEACHER',
            },
          }),
          prisma.userTenant.count({
            where: {
              tenantId: session.user.tenantId,
              role: 'STUDENT',
            },
          }),
          prisma.userTenant.count({
            where: {
              tenantId: session.user.tenantId,
              role: 'PARENT',
            },
          }),
        ]);

        groups.push(
          {
            id: 'all_teachers',
            name: 'Tutti i Docenti',
            description: 'Gruppo con tutti i docenti della scuola',
            type: 'TEACHERS',
            memberCount: teachersCount,
            createdAt: new Date(),
          },
          {
            id: 'all_students',
            name: 'Tutti gli Studenti',
            description: 'Gruppo con tutti gli studenti della scuola',
            type: 'STUDENTS',
            memberCount: studentsCount,
            createdAt: new Date(),
          },
          {
            id: 'all_parents',
            name: 'Tutti i Genitori',
            description: 'Gruppo con tutti i genitori della scuola',
            type: 'PARENTS',
            memberCount: parentsCount,
            createdAt: new Date(),
          }
        );
      }

      // Sort by creation date
      groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedGroups = groups.slice(startIndex, startIndex + limit);
      const totalPages = Math.ceil(groups.length / limit);

      return NextResponse.json({
        groups: paginatedGroups,
        pagination: {
          page,
          limit,
          total: groups.length,
          totalPages,
        },
      });

    } catch (dbError) {
      console.error('Database error in groups API:', dbError);
      // Return empty groups on database error
      return NextResponse.json({
        groups: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching message groups:', error);
    return NextResponse.json(
      { 
        groups: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        }
      },
      { status: 500 }
    );
  }
}
