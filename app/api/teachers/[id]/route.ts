import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teachers/[id] - Get single teacher
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Teachers can view their own profile, admins can view any teacher
    const canViewTeacher = 
      ['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role);

    if (!canViewTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    const teacher = await prisma.teacher.findFirst({
      where,
      include: {
        classes: {
          include: {
            course: {
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
        },
        lessons: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            startTime: 'desc',
          },
          take: 50, // Limit recent lessons
        },
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // Transform teacher for response
    const responseTeacher = {
      id: teacher.id,
      teacherCode: teacher.teacherCode,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      phone: teacher.phone,
      address: teacher.address,
      avatar: null, // TODO: Add avatar support
      qualifications: teacher.qualifications,
      specializations: teacher.specializations,
      biography: teacher.biography,
      experience: null, // TODO: Calculate from hireDate
      hourlyRate: teacher.hourlyRate,
      contractType: teacher.contractType,
      role: 'TEACHER',
      status: teacher.status,
      hireDate: teacher.hireDate,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
      classes: teacher.classes?.map(cls => ({
        id: cls.id,
        name: cls.name,
        level: cls.course.name, // Use course name as level for now
        schedule: `${cls.startDate} - ${cls.endDate || 'Ongoing'}`, // Format schedule
        status: cls.isActive ? 'ACTIVE' : 'INACTIVE',
        course: cls.course,
        _count: cls._count,
      })),
      lessons: teacher.lessons?.map(lesson => ({
        id: lesson.id,
        date: lesson.startTime,
        topic: lesson.title,
        duration: lesson.endTime && lesson.startTime 
          ? Math.round((new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime()) / (1000 * 60))
          : null,
        status: lesson.status,
        class: lesson.class,
      })),
    };

    return NextResponse.json(responseTeacher);

  } catch (error) {
    console.error('Teacher GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/teachers/[id] - Update teacher
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Teachers can update their own profile, admins can update any teacher
    const canUpdateTeacher = 
      ['ADMIN', 'SUPERADMIN'].includes(session.user.role) ||
      (session.user.role === 'TEACHER' && session.user.id === id);

    if (!canUpdateTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if teacher exists and is accessible
    const existingTeacher = await prisma.teacher.findFirst({
      where,
    });

    if (!existingTeacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    const { 
      firstName, 
      lastName, 
      email,
      phone,
      address,
      qualifications,
      specializations,
      biography,
      hourlyRate,
      contractType,
      status
    } = body;

    // Basic profile updates
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (qualifications !== undefined) updateData.qualifications = qualifications;
    if (specializations !== undefined) updateData.specializations = specializations;
    if (biography !== undefined) updateData.biography = biography;
    if (contractType !== undefined) updateData.contractType = contractType;

    // Email update (admin only or for own profile with validation)
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Check if email is already in use by another teacher
      const existingWithEmail = await prisma.teacher.findFirst({
        where: {
          email,
          tenantId: existingTeacher.tenantId,
          id: { not: id },
        },
      });

      if (existingWithEmail) {
        return NextResponse.json(
          { error: 'Email already in use by another teacher' },
          { status: 409 }
        );
      }

      updateData.email = email;
    }

    // Hourly rate update
    if (hourlyRate !== undefined) {
      if (hourlyRate === null || hourlyRate === '') {
        updateData.hourlyRate = null;
      } else {
        const rate = parseFloat(hourlyRate);
        if (isNaN(rate) || rate < 0) {
          return NextResponse.json(
            { error: 'Invalid hourly rate' },
            { status: 400 }
          );
        }
        updateData.hourlyRate = rate;
      }
    }

    // Status update (admin only)
    if (status && ['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Update teacher
    const updatedTeacher = await prisma.teacher.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Transform response
    const responseTeacher = {
      id: updatedTeacher.id,
      teacherCode: updatedTeacher.teacherCode,
      firstName: updatedTeacher.firstName,
      lastName: updatedTeacher.lastName,
      email: updatedTeacher.email,
      phone: updatedTeacher.phone,
      address: updatedTeacher.address,
      qualifications: updatedTeacher.qualifications,
      specializations: updatedTeacher.specializations,
      biography: updatedTeacher.biography,
      hourlyRate: updatedTeacher.hourlyRate,
      contractType: updatedTeacher.contractType,
      status: updatedTeacher.status,
      hireDate: updatedTeacher.hireDate,
      createdAt: updatedTeacher.createdAt,
      updatedAt: updatedTeacher.updatedAt,
      tenant: updatedTeacher.tenant,
    };

    return NextResponse.json({
      message: 'Teacher updated successfully',
      teacher: responseTeacher,
    });

  } catch (error) {
    console.error('Teacher PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teachers/[id] - Delete teacher
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN can delete teachers
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if teacher exists and is accessible
    const teacher = await prisma.teacher.findFirst({
      where,
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // Check for active classes before deletion
    const activeClasses = await prisma.class.count({
      where: {
        teacherId: id,
        isActive: true,
      },
    });

    if (activeClasses > 0) {
      return NextResponse.json(
        { error: 'Cannot delete teacher with active classes. Please reassign or deactivate classes first.' },
        { status: 400 }
      );
    }

    // Delete teacher (cascade will handle related records appropriately)
    await prisma.teacher.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Teacher deleted successfully',
    });

  } catch (error) {
    console.error('Teacher DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
