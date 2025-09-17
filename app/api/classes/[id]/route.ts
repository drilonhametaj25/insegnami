import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/classes/[id] - Get single class
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

    // For teachers, only allow access to their own classes
    if (session.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });

      if (teacher) {
        where.teacherId = teacher.id;
      } else {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      }
    }

    const classData = await prisma.class.findFirst({
      where,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            category: true,
            level: true,
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
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        lessons: {
          orderBy: {
            startTime: 'desc',
          },
          take: 50, // Limit recent lessons
        },
        _count: {
          select: {
            students: true,
            lessons: true,
          },
        },
      },
    });
           

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Transform class for response
    const responseClass = {
      id: classData.id,
      code: classData.code,
      name: classData.name,
      maxStudents: classData.maxStudents,
      startDate: classData.startDate,
      endDate: classData.endDate,
      isActive: classData.isActive,
      createdAt: classData.createdAt,
      updatedAt: classData.updatedAt,
      course: classData.course,
      teacher: classData.teacher,
      students: classData.students.map(sc => sc.student),
      studentCount: classData._count.students,
      lessonCount: classData._count.lessons,
    };

    return NextResponse.json({ class: responseClass });

  } catch (error) {
    console.error('Class GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/classes/[id] - Update class
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN can update classes
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if class exists and is accessible
    const existingClass = await prisma.class.findFirst({
      where,
      include: {
        course: true,
      },
    });

    if (!existingClass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    const { 
      name, 
      courseId,
      teacherId,
      maxStudents,
      startDate,
      endDate,
      isActive
    } = body;

    // Basic updates
    if (name !== undefined) updateData.name = name;
    if (maxStudents !== undefined) {
      if (maxStudents === null || maxStudents === '') {
        updateData.maxStudents = 20;
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

    // Course update
    if (courseId !== undefined) {
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

      updateData.courseId = courseId;
    }

    // Teacher update
    if (teacherId !== undefined) {
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

      updateData.teacherId = teacherId;
    }

    // Date updates
    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    // Validate dates if both are being updated
    const finalStartDate = updateData.startDate || existingClass.startDate;
    const finalEndDate = updateData.endDate !== undefined ? updateData.endDate : existingClass.endDate;

    if (finalEndDate && finalStartDate >= finalEndDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Status update
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // Update class
    const updatedClass = await prisma.class.update({
      where: { id },
      data: updateData,
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
            lessons: true,
          },
        },
      },
    });

    // Transform response
    const responseClass = {
      id: updatedClass.id,
      code: updatedClass.code,
      name: updatedClass.name,
      maxStudents: updatedClass.maxStudents,
      startDate: updatedClass.startDate,
      endDate: updatedClass.endDate,
      isActive: updatedClass.isActive,
      createdAt: updatedClass.createdAt,
      updatedAt: updatedClass.updatedAt,
      course: updatedClass.course,
      teacher: updatedClass.teacher,
      tenant: updatedClass.tenant,
      studentCount: updatedClass._count.students,
      lessonCount: updatedClass._count.lessons,
    };

    return NextResponse.json({
      message: 'Class updated successfully',
      class: responseClass,
    });

  } catch (error) {
    console.error('Class PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/classes/[id] - Delete class
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN can delete classes
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if class exists and is accessible
    const classData = await prisma.class.findFirst({
      where,
      include: {
        _count: {
          select: {
            students: true,
            lessons: true,
            payments: true,
          },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Check for dependencies before deletion
    if (classData._count.students > 0) {
      return NextResponse.json(
        { error: 'Cannot delete class with enrolled students. Please remove students first.' },
        { status: 400 }
      );
    }

    if (classData._count.lessons > 0) {
      return NextResponse.json(
        { error: 'Cannot delete class with lessons. Please delete lessons first.' },
        { status: 400 }
      );
    }

    if (classData._count.payments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete class with payment records.' },
        { status: 400 }
      );
    }

    // Delete class
    await prisma.class.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Class deleted successfully',
    });

  } catch (error) {
    console.error('Class DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
