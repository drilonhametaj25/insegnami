import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/teachers - List teachers with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can list teachers
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
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
        { teacherCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Get teachers with pagination
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        include: {
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
      prisma.teacher.count({ where }),
    ]);

    // Transform teachers for response
    const transformedTeachers = teachers.map(teacher => ({
      id: teacher.id,
      teacherCode: teacher.teacherCode,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      phone: teacher.phone,
      address: teacher.address,
      qualifications: teacher.qualifications,
      specializations: teacher.specializations,
      biography: teacher.biography,
      hourlyRate: teacher.hourlyRate,
      contractType: teacher.contractType,
      status: teacher.status,
      hireDate: teacher.hireDate,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
      tenant: teacher.tenant,
    }));

    return NextResponse.json({
      teachers: transformedTeachers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Teachers GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teachers - Create new teacher
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create teachers
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
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
      tenantId 
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
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

    // Check if teacher email is already in use
    const existingTeacher = await prisma.teacher.findFirst({
      where: { 
        email,
        tenantId: targetTenantId 
      },
    });

    if (existingTeacher) {
      return NextResponse.json(
        { error: 'A teacher with this email already exists' },
        { status: 409 }
      );
    }

    // Generate unique teacher code
    const codePrefix = tenant.slug.toUpperCase().substring(0, 3);
    const teacherCount = await prisma.teacher.count({
      where: { tenantId: targetTenantId },
    });
    const teacherCode = `T${codePrefix}${String(teacherCount + 1).padStart(3, '0')}`;

    // Validate hourly rate if provided
    let validatedHourlyRate = null;
    if (hourlyRate) {
      const rate = parseFloat(hourlyRate);
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json(
          { error: 'Invalid hourly rate' },
          { status: 400 }
        );
      }
      validatedHourlyRate = rate;
    }

    // Create teacher
    const teacher = await prisma.teacher.create({
      data: {
        teacherCode,
        firstName,
        lastName,
        email,
        phone: phone || null,
        address: address || null,
        qualifications: qualifications || null,
        specializations: specializations || null,
        biography: biography || null,
        hourlyRate: validatedHourlyRate,
        contractType: contractType || null,
        tenantId: targetTenantId,
        status: 'ACTIVE',
        hireDate: new Date(),
      },
    });

    // Fetch created teacher with relations
    const createdTeacher = await prisma.teacher.findUnique({
      where: { id: teacher.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!createdTeacher) {
      throw new Error('Failed to retrieve created teacher');
    }

    // Transform response
    const responseTeacher = {
      id: createdTeacher.id,
      teacherCode: createdTeacher.teacherCode,
      firstName: createdTeacher.firstName,
      lastName: createdTeacher.lastName,
      email: createdTeacher.email,
      phone: createdTeacher.phone,
      address: createdTeacher.address,
      qualifications: createdTeacher.qualifications,
      specializations: createdTeacher.specializations,
      biography: createdTeacher.biography,
      hourlyRate: createdTeacher.hourlyRate,
      contractType: createdTeacher.contractType,
      status: createdTeacher.status,
      hireDate: createdTeacher.hireDate,
      createdAt: createdTeacher.createdAt,
      updatedAt: createdTeacher.updatedAt,
      tenant: createdTeacher.tenant,
    };

    return NextResponse.json({
      message: 'Teacher created successfully',
      teacher: responseTeacher,
    });

  } catch (error) {
    console.error('Teachers POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
