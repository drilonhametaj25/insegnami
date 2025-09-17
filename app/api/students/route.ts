import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/students - List students with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, TEACHER can list students
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId') || '';
    const status = searchParams.get('status') || '';

    const skip = (page - 1) * limit;

    // Build where clause with tenant scoping
    const where: any = {};
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Search filter
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Class filter
    if (classId) {
      where.classes = {
        some: {
          classId: classId,
        },
      };
    }

    // Get students with pagination
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          lastName: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    // Transform students for response
    const transformedStudents = students.map(student => ({
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
      classes: student.classes.map((sc: any) => ({
        classId: sc.classId,
        className: sc.class.name,
        classCode: sc.class.code,
        enrolledAt: sc.enrolledAt,
        isActive: sc.isActive,
      })),
      tenant: student.tenant,
    }));

    return NextResponse.json({
      students: transformedStudents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Students GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/students - Create new student
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create students
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
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
      classIds = [],
      tenantId 
    } = body;

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
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

    // Determine target tenant
    let targetTenantId = tenantId;
    if (session.user.role !== 'SUPERADMIN') {
      targetTenantId = session.user.tenantId; // Force current tenant
    }

    if (!targetTenantId) {
      return NextResponse.json(
        { error: 'Tenant ID required' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: targetTenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Verify parent exists if provided
    // Note: In this schema, parent info is stored as strings, not as User relation

    // Generate unique student code
    const codePrefix = tenant.slug.toUpperCase().substring(0, 3);
    const studentCount = await prisma.student.count({
      where: { tenantId: targetTenantId },
    });
    const studentCode = `${codePrefix}${String(studentCount + 1).padStart(4, '0')}`;

    // Create student and class enrollments in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create student
      const student = await tx.student.create({
        data: {
          studentCode,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1900-01-01'), // Required field in schema
          address: address || null,
          emergencyContact: emergencyContact || null,
          parentName: parentName || null,
          parentEmail: parentEmail || null,
          parentPhone: parentPhone || null,
          medicalNotes: medicalNotes || null,
          specialNeeds: specialNeeds || null,
          tenantId: targetTenantId,
          status: 'ACTIVE',
          enrollmentDate: new Date(),
        },
      });

      // Enroll in classes if provided
      if (classIds.length > 0) {
        // Verify classes exist and belong to tenant
        const classes = await tx.class.findMany({
          where: {
            id: { in: classIds },
            tenantId: targetTenantId,
          },
        });

        if (classes.length !== classIds.length) {
          throw new Error('One or more classes not found');
        }

        // Create enrollments
        await tx.studentClass.createMany({
          data: classIds.map((classId: string) => ({
            studentId: student.id,
            classId,
            enrolledAt: new Date(),
          })),
        });
      }

      return student;
    });

    // Fetch created student with relations
    const createdStudent = await prisma.student.findUnique({
      where: { id: result.id },
      include: {
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!createdStudent) {
      throw new Error('Failed to retrieve created student');
    }

    // Transform response
    const responseStudent = {
      id: createdStudent.id,
      studentCode: createdStudent.studentCode,
      firstName: createdStudent.firstName,
      lastName: createdStudent.lastName,
      email: createdStudent.email,
      phone: createdStudent.phone,
      dateOfBirth: createdStudent.dateOfBirth,
      address: createdStudent.address,
      emergencyContact: createdStudent.emergencyContact,
      parentName: createdStudent.parentName,
      parentEmail: createdStudent.parentEmail,
      parentPhone: createdStudent.parentPhone,
      medicalNotes: createdStudent.medicalNotes,
      specialNeeds: createdStudent.specialNeeds,
      status: createdStudent.status,
      enrollmentDate: createdStudent.enrollmentDate,
      classes: createdStudent.classes.map((sc: any) => ({
        classId: sc.classId,
        className: sc.class.name,
        classCode: sc.class.code,
        enrolledAt: sc.enrolledAt,
        isActive: sc.isActive,
      })),
      tenant: createdStudent.tenant,
    };

    return NextResponse.json({
      message: 'Student created successfully',
      student: responseStudent,
    });

  } catch (error) {
    console.error('Students POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
