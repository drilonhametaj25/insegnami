import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/students/[id] - Get single student
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN, TEACHER, and the student's parent can view student details
    if (!['ADMIN', 'TEACHER', 'PARENT', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    const student = await prisma.student.findFirst({
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
            class: {
              include: {
                course: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                teacher: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Transform student for response
    const responseStudent = {
      id: student.id,
      studentCode: student.studentCode,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      dateOfBirth: student.dateOfBirth,
      address: student.address,
      emergencyContact: student.emergencyContact,
      parentName: student.parentName,
      parentEmail: student.parentEmail,
      parentPhone: student.parentPhone,
      medicalNotes: student.medicalNotes,
      specialNeeds: student.specialNeeds,
      status: student.status,
      enrollmentDate: student.enrollmentDate,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      tenant: student.tenant,
      classes: student.classes.map(sc => ({
        id: sc.class.id,
        name: sc.class.name,
        level: sc.class.course.name, // Use course name as level
        description: `Class ${sc.class.name}`, // Default description
        status: sc.class.isActive ? 'ACTIVE' : 'INACTIVE',
        schedule: `${sc.class.startDate.toLocaleDateString()} - ${sc.class.endDate ? sc.class.endDate.toLocaleDateString() : 'Ongoing'}`, // Use date range
        enrolledAt: sc.enrolledAt,
        course: sc.class.course,
        teacher: sc.class.teacher,
      })),
    };

    return NextResponse.json(responseStudent);

  } catch (error) {
    console.error('Student GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/students/[id] - Update student
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only ADMIN can update students
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if student exists and is accessible
    const existingStudent = await prisma.student.findFirst({
      where,
    });

    if (!existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    const { 
      firstName, 
      lastName, 
      email,
      phone,
      dateOfBirth,
      address,
      emergencyContact,
      parentName,
      parentEmail,
      parentPhone,
      medicalNotes,
      specialNeeds,
      status
    } = body;

    // Update fields if provided
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : existingStudent.dateOfBirth;
    if (address !== undefined) updateData.address = address;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (parentName !== undefined) updateData.parentName = parentName;
    if (parentEmail !== undefined) updateData.parentEmail = parentEmail;
    if (parentPhone !== undefined) updateData.parentPhone = parentPhone;
    if (medicalNotes !== undefined) updateData.medicalNotes = medicalNotes;
    if (specialNeeds !== undefined) updateData.specialNeeds = specialNeeds;

    // Status update
    if (status) {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Update student
    const updatedStudent = await prisma.student.update({
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
    const responseStudent = {
      id: updatedStudent.id,
      studentCode: updatedStudent.studentCode,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      email: updatedStudent.email,
      phone: updatedStudent.phone,
      dateOfBirth: updatedStudent.dateOfBirth,
      address: updatedStudent.address,
      emergencyContact: updatedStudent.emergencyContact,
      parentName: updatedStudent.parentName,
      parentEmail: updatedStudent.parentEmail,
      parentPhone: updatedStudent.parentPhone,
      medicalNotes: updatedStudent.medicalNotes,
      specialNeeds: updatedStudent.specialNeeds,
      status: updatedStudent.status,
      enrollmentDate: updatedStudent.enrollmentDate,
      createdAt: updatedStudent.createdAt,
      updatedAt: updatedStudent.updatedAt,
      tenant: updatedStudent.tenant,
    };

    return NextResponse.json({
      message: 'Student updated successfully',
      student: responseStudent,
    });

  } catch (error) {
    console.error('Student PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/students/[id] - Delete student
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only ADMIN can delete students
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Check if student exists and is accessible
    const student = await prisma.student.findFirst({
      where,
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check if student has any active relationships before deletion
    // For now, we'll allow deletion - in production you might want stricter checks

    // Delete student (cascade will handle related records)
    await prisma.student.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Student deleted successfully',
    });

  } catch (error) {
    console.error('Student DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
