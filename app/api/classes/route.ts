import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/classes - Get classes
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const courseId = searchParams.get('courseId') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const isActive = searchParams.get('isActive');
    const include = searchParams.get('include') || '';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const offset = (page - 1) * limit;

    // Build where clause with tenant scoping
    const where: any = {};
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Search filters
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { course: { name: { contains: search, mode: 'insensitive' } } },
        { course: { category: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (courseId) {
      where.courseId = courseId;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    // For teachers, only show their own classes
    if (session.user.role === 'TEACHER') {
      // Find teacher record for current user
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });

      if (teacher) {
        where.teacherId = teacher.id;
      } else {
        // If no teacher record found, return empty
        return NextResponse.json({
          classes: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }
    }

    // Build include clause
    const includeClause: any = {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          category: true,
          level: true,
          price: true,
        },
      },
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          students: {
            where: { isActive: true }
          },
          lessons: true,
        },
      },
    };

    // Add detailed includes if requested
    const includeOptions = include.split(',').filter(Boolean);
    if (includeOptions.includes('students')) {
      includeClause.students = {
        where: { isActive: true },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              studentCode: true,
            }
          }
        }
      };
    }

    if (includeOptions.includes('lessons')) {
      includeClause.lessons = {
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
          room: true,
        },
        orderBy: { startTime: 'asc' },
        take: 10 // Limit lessons for performance
      };
    }

    // Build sort options
    let orderBy: any = { name: 'asc' };
    
    switch (sortBy) {
      case 'name':
        orderBy = { name: sortOrder };
        break;
      case 'startDate':
        orderBy = { startDate: sortOrder };
        break;
      case 'course':
        orderBy = { course: { name: sortOrder } };
        break;
      case 'teacher':
        orderBy = { teacher: { lastName: sortOrder } };
        break;
      case 'studentCount':
        // This will be handled in application layer
        orderBy = { name: 'asc' };
        break;
      default:
        orderBy = { [sortBy]: sortOrder };
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: includeClause,
        orderBy: [
          { isActive: 'desc' },
          orderBy,
        ],
        skip: offset,
        take: limit,
      }),
      prisma.class.count({ where }),
    ]);

    // Sort by student count if requested
    let sortedClasses = classes;
    if (sortBy === 'studentCount') {
      sortedClasses = classes.sort((a: any, b: any) => {
        const aCount = a._count?.students || 0;
        const bCount = b._count?.students || 0;
        return sortOrder === 'asc' ? aCount - bCount : bCount - aCount;
      });
    }

    const totalPages = Math.ceil(total / limit);

    // Transform classes for response
    const responseClasses = sortedClasses.map((cls: any) => ({
      id: cls.id,
      code: cls.code,
      name: cls.name,
      maxStudents: cls.maxStudents,
      startDate: cls.startDate,
      endDate: cls.endDate,
      isActive: cls.isActive,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt,
      course: cls.course,
      teacher: cls.teacher,
      tenant: cls.tenant,
      _count: cls._count,
      students: cls.students,
      lessons: cls.lessons,
    }));

    return NextResponse.json({
      classes: responseClasses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Classes GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/classes - Create new class
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create classes
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      courseId,
      teacherId,
      maxStudents,
      startDate,
      endDate,
    } = body;

    // Validation
    if (!name || !courseId || !teacherId || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: name, courseId, teacherId, startDate' },
        { status: 400 }
      );
    }

    // Validate course exists and belongs to tenant
    const courseWhere: any = { id: courseId };
    if (session.user.role !== 'SUPERADMIN') {
      courseWhere.tenantId = session.user.tenantId;
    }

    const course = await prisma.course.findFirst({
      where: courseWhere,
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found or not accessible' },
        { status: 400 }
      );
    }

    // Validate teacher exists and belongs to tenant
    const teacherWhere: any = { id: teacherId };
    if (session.user.role !== 'SUPERADMIN') {
      teacherWhere.tenantId = session.user.tenantId;
    }

    const teacher = await prisma.teacher.findFirst({
      where: teacherWhere,
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found or not accessible' },
        { status: 400 }
      );
    }

    // Validate maxStudents
    if (maxStudents && (isNaN(maxStudents) || maxStudents < 1)) {
      return NextResponse.json(
        { error: 'Max students must be a positive number' },
        { status: 400 }
      );
    }

    // Validate dates
    if (endDate && new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Generate unique class code
    const tenantId = session.user.role === 'SUPERADMIN' ? course.tenantId : session.user.tenantId;
    let code: string = '';
    let codeExists = true;
    let attempts = 0;

    while (codeExists && attempts < 10) {
      const courseCode = course.code.substring(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      code = `${courseCode}${random}`;

      const existing = await prisma.class.findFirst({
        where: {
          code,
          tenantId,
        },
      });

      codeExists = !!existing;
      attempts++;
    }

    if (codeExists || !code) {
      return NextResponse.json(
        { error: 'Unable to generate unique class code' },
        { status: 500 }
      );
    }

    // Create class
    const newClass = await prisma.class.create({
      data: {
        code,
        name,
        courseId,
        teacherId,
        tenantId,
        maxStudents: maxStudents || 20,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        isActive: true,
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            category: true,
            level: true,
            price: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    // Transform response
    const responseClass = {
      id: newClass.id,
      code: newClass.code,
      name: newClass.name,
      maxStudents: newClass.maxStudents,
      startDate: newClass.startDate,
      endDate: newClass.endDate,
      isActive: newClass.isActive,
      createdAt: newClass.createdAt,
      updatedAt: newClass.updatedAt,
      course: newClass.course,
      teacher: newClass.teacher,
      tenant: newClass.tenant,
      studentCount: newClass._count.students,
    };

    return NextResponse.json({
      message: 'Class created successfully',
      class: responseClass,
    }, { status: 201 });

  } catch (error) {
    console.error('Class POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
