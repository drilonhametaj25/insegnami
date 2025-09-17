import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/courses - Get courses
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
    const category = searchParams.get('category') || '';
    const level = searchParams.get('level') || '';
    const isActive = searchParams.get('isActive');

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
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (level) {
      where.level = { contains: level, mode: 'insensitive' };
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              classes: true,
            },
          },
        },
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Transform courses for response
    const responseCourses = courses.map(course => ({
      id: course.id,
      code: course.code,
      name: course.name,
      description: course.description,
      category: course.category,
      level: course.level,
      duration: course.duration,
      maxStudents: course.maxStudents,
      minStudents: course.minStudents,
      price: course.price,
      isActive: course.isActive,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      tenant: course.tenant,
      classCount: course._count.classes,
    }));

    return NextResponse.json({
      courses: responseCourses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Courses GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/courses - Create new course
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create courses
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      level,
      duration,
      maxStudents,
      minStudents,
      price,
    } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (duration && (isNaN(duration) || duration < 1)) {
      return NextResponse.json(
        { error: 'Duration must be a positive number' },
        { status: 400 }
      );
    }

    if (maxStudents && (isNaN(maxStudents) || maxStudents < 1)) {
      return NextResponse.json(
        { error: 'Max students must be a positive number' },
        { status: 400 }
      );
    }

    if (minStudents && (isNaN(minStudents) || minStudents < 1)) {
      return NextResponse.json(
        { error: 'Min students must be a positive number' },
        { status: 400 }
      );
    }

    if (minStudents && maxStudents && minStudents > maxStudents) {
      return NextResponse.json(
        { error: 'Min students cannot be greater than max students' },
        { status: 400 }
      );
    }

    if (price && (isNaN(price) || price < 0)) {
      return NextResponse.json(
        { error: 'Price must be a non-negative number' },
        { status: 400 }
      );
    }

    // Generate unique course code
    const tenantId = session.user.tenantId;
    let code: string = '';
    let codeExists = true;
    let attempts = 0;

    while (codeExists && attempts < 10) {
      const nameCode = name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
      const categoryCode = category ? category.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase() : '';
      const random = Math.random().toString(36).substring(2, 4).toUpperCase();
      code = `${nameCode}${categoryCode}${random}`;

      const existing = await prisma.course.findFirst({
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
        { error: 'Unable to generate unique course code' },
        { status: 500 }
      );
    }

    // Create course
    const newCourse = await prisma.course.create({
      data: {
        code,
        name,
        description: description || null,
        category: category || null,
        level: level || null,
        duration: duration || null,
        maxStudents: maxStudents || null,
        minStudents: minStudents || null,
        price: price ? parseFloat(price) : null,
        tenantId,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });

    // Transform response
    const responseCourse = {
      id: newCourse.id,
      code: newCourse.code,
      name: newCourse.name,
      description: newCourse.description,
      category: newCourse.category,
      level: newCourse.level,
      duration: newCourse.duration,
      maxStudents: newCourse.maxStudents,
      minStudents: newCourse.minStudents,
      price: newCourse.price,
      isActive: newCourse.isActive,
      createdAt: newCourse.createdAt,
      updatedAt: newCourse.updatedAt,
      tenant: newCourse.tenant,
      classCount: newCourse._count.classes,
    };

    return NextResponse.json({
      message: 'Course created successfully',
      course: responseCourse,
    }, { status: 201 });

  } catch (error) {
    console.error('Course POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
