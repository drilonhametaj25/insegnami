import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/courses/[id] - Get single course
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    const course = await prisma.course.findFirst({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        classes: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                students: true,
              },
            },
          },
          orderBy: [
            { isActive: 'desc' },
            { startDate: 'desc' },
          ],
        },
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Transform course for response
    const responseCourse = {
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
      classes: course.classes.map(cls => ({
        id: cls.id,
        code: cls.code,
        name: cls.name,
        maxStudents: cls.maxStudents,
        startDate: cls.startDate,
        endDate: cls.endDate,
        isActive: cls.isActive,
        teacher: cls.teacher,
        studentCount: cls._count.students,
      })),
      classCount: course._count.classes,
    };

    return NextResponse.json({ course: responseCourse });

  } catch (error) {
    console.error('Course GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/courses/[id] - Update course
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN can update courses
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if course exists and is accessible
    const existingCourse = await prisma.course.findFirst({
      where,
    });

    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    const { 
      name, 
      description,
      category,
      level,
      duration,
      maxStudents,
      minStudents,
      price,
      isActive
    } = body;

    // Basic updates
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (category !== undefined) updateData.category = category || null;
    if (level !== undefined) updateData.level = level || null;

    // Numeric field updates with validation
    if (duration !== undefined) {
      if (duration === null || duration === '') {
        updateData.duration = null;
      } else {
        const dur = parseInt(duration);
        if (isNaN(dur) || dur < 1) {
          return NextResponse.json(
            { error: 'Duration must be a positive number' },
            { status: 400 }
          );
        }
        updateData.duration = dur;
      }
    }

    if (maxStudents !== undefined) {
      if (maxStudents === null || maxStudents === '') {
        updateData.maxStudents = null;
      } else {
        const max = parseInt(maxStudents);
        if (isNaN(max) || max < 1) {
          return NextResponse.json(
            { error: 'Max students must be a positive number' },
            { status: 400 }
          );
        }
        updateData.maxStudents = max;
      }
    }

    if (minStudents !== undefined) {
      if (minStudents === null || minStudents === '') {
        updateData.minStudents = null;
      } else {
        const min = parseInt(minStudents);
        if (isNaN(min) || min < 1) {
          return NextResponse.json(
            { error: 'Min students must be a positive number' },
            { status: 400 }
          );
        }
        updateData.minStudents = min;
      }
    }

    // Validate min vs max students
    const finalMin = updateData.minStudents !== undefined ? updateData.minStudents : existingCourse.minStudents;
    const finalMax = updateData.maxStudents !== undefined ? updateData.maxStudents : existingCourse.maxStudents;

    if (finalMin && finalMax && finalMin > finalMax) {
      return NextResponse.json(
        { error: 'Min students cannot be greater than max students' },
        { status: 400 }
      );
    }

    if (price !== undefined) {
      if (price === null || price === '') {
        updateData.price = null;
      } else {
        const prc = parseFloat(price);
        if (isNaN(prc) || prc < 0) {
          return NextResponse.json(
            { error: 'Price must be a non-negative number' },
            { status: 400 }
          );
        }
        updateData.price = prc;
      }
    }

    // Status update
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // Update course
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
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
      id: updatedCourse.id,
      code: updatedCourse.code,
      name: updatedCourse.name,
      description: updatedCourse.description,
      category: updatedCourse.category,
      level: updatedCourse.level,
      duration: updatedCourse.duration,
      maxStudents: updatedCourse.maxStudents,
      minStudents: updatedCourse.minStudents,
      price: updatedCourse.price,
      isActive: updatedCourse.isActive,
      createdAt: updatedCourse.createdAt,
      updatedAt: updatedCourse.updatedAt,
      tenant: updatedCourse.tenant,
      classCount: updatedCourse._count.classes,
    };

    return NextResponse.json({
      message: 'Course updated successfully',
      course: responseCourse,
    });

  } catch (error) {
    console.error('Course PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[id] - Delete course
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN can delete courses
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if course exists and is accessible
    const course = await prisma.course.findFirst({
      where,
      include: {
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check for dependencies before deletion
    if (course._count.classes > 0) {
      return NextResponse.json(
        { error: 'Cannot delete course with existing classes. Please delete or reassign classes first.' },
        { status: 400 }
      );
    }

    // Delete course
    await prisma.course.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Course deleted successfully',
    });

  } catch (error) {
    console.error('Course DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
