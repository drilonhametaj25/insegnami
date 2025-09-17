import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Generate temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
            },
          },
          parentUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
            },
          },
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
        } as any, // Temporary cast for new relations
        orderBy: {
          lastName: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    // Transform students for response
    const transformedStudents = students.map((student: any) => ({
      id: student.id,
      studentCode: student.studentCode,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      dateOfBirth: student.dateOfBirth,
      address: student.address,
      emergencyContact: student.emergencyContact,
      parentName: student.parentUser ? `${student.parentUser.firstName} ${student.parentUser.lastName}` : null,
      parentEmail: student.parentUser?.email || null,
      parentPhone: student.parentUser?.phone || null,
      medicalNotes: student.medicalNotes,
      specialNeeds: student.specialNeeds,
      status: student.status,
      enrollmentDate: student.enrollmentDate,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      classes: student.classes.map((sc: any) => ({
        id: sc.class.id,
        name: sc.class.name,
        code: sc.class.code,
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

// POST /api/students - Create new student with advanced options
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

    const data = await request.json();

    // Student data
    const {
      firstName,
      lastName,
      dateOfBirth,
      email,
      phone,
      address,
      emergencyContact,
      medicalNotes,
      specialNeeds,
      status = 'ACTIVE',
      
      // Account management
      createStudentAccount = false,
      studentPassword,
      
      // Parent management
      hasParent = false,
      parentType, // 'new', 'existing', 'search'
      
      // New parent data
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      parentPassword,
      
      // Existing parent
      existingParentId,
    } = data;

    let studentUser = null;
    let parentUser = null;

    // Create student account if requested
    if (createStudentAccount) {
      if (!email) {
        return NextResponse.json(
          { error: 'Email richiesta per account studente' },
          { status: 400 }
        );
      }

      if (!studentPassword) {
        return NextResponse.json(
          { error: 'Password richiesta per account studente' },
          { status: 400 }
        );
      }

      // Check if email is already used
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email già utilizzata da un altro utente' },
          { status: 400 }
        );
      }

      const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);

      studentUser = await prisma.user.create({
        data: {
          email,
          password: hashedStudentPassword,
          firstName,
          lastName,
          phone: phone || null,
          status: 'ACTIVE',
          emailVerified: new Date(),
        } as any,
      });

      // Add to tenant
      await prisma.userTenant.create({
        data: {
          userId: studentUser.id,
          tenantId: session.user.tenantId,
          role: 'STUDENT',
          permissions: JSON.stringify({
            classes: { read: true },
            lessons: { read: true },
            attendance: { read: true },
            payments: { read: true },
            notices: { read: true },
          }),
        },
      });
    }

    // Handle parent account
    if (hasParent) {
      if (parentType === 'existing' || parentType === 'search') {
        // Use existing parent
        if (!existingParentId) {
          return NextResponse.json(
            { error: 'ID genitore richiesto per genitore esistente' },
            { status: 400 }
          );
        }

        parentUser = await prisma.user.findUnique({
          where: { id: existingParentId },
        });

        if (!parentUser) {
          return NextResponse.json(
            { error: 'Genitore non trovato' },
            { status: 404 }
          );
        }

        // Ensure parent has PARENT role in this tenant
        const existingUserTenant = await prisma.userTenant.findUnique({
          where: {
            userId_tenantId: {
              userId: parentUser.id,
              tenantId: session.user.tenantId,
            },
          },
        });

        if (!existingUserTenant) {
          await prisma.userTenant.create({
            data: {
              userId: parentUser.id,
              tenantId: session.user.tenantId,
              role: 'PARENT',
              permissions: JSON.stringify({
                students: { read: true },
                attendance: { read: true },
                payments: { read: true },
                notices: { read: true },
              }),
            },
          });
        }
      } else if (parentType === 'new') {
        // Create new parent
        if (!parentFirstName || !parentLastName || !parentEmail || !parentPassword) {
          return NextResponse.json(
            { error: 'Tutti i dati del genitore sono richiesti per nuovo account' },
            { status: 400 }
          );
        }

        // Check if email is already used
        const existingParent = await prisma.user.findUnique({
          where: { email: parentEmail },
        });

        if (existingParent) {
          return NextResponse.json(
            { error: 'Email genitore già utilizzata da un altro utente' },
            { status: 400 }
          );
        }

        const hashedParentPassword = await bcrypt.hash(parentPassword, 10);

        parentUser = await prisma.user.create({
          data: {
            email: parentEmail,
            password: hashedParentPassword,
            firstName: parentFirstName,
            lastName: parentLastName,
            phone: parentPhone || null,
            status: 'ACTIVE',
            emailVerified: new Date(),
          } as any,
        });

        // Add to tenant
        await prisma.userTenant.create({
          data: {
            userId: parentUser.id,
            tenantId: session.user.tenantId,
            role: 'PARENT',
            permissions: JSON.stringify({
              students: { read: true },
              attendance: { read: true },
              payments: { read: true },
              notices: { read: true },
            }),
          },
        });
      }
    }

    // Generate unique student code
    const studentCount = await prisma.student.count({
      where: { tenantId: session.user.tenantId },
    });
    const studentCode = `S${(studentCount + 1).toString().padStart(3, '0')}`;

    // Create student record
    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1900-01-01'),
        email,
        phone,
        address,
        studentCode,
        emergencyContact,
        medicalNotes,
        specialNeeds,
        status,
        tenantId: session.user.tenantId,
        userId: studentUser?.id,
        parentUserId: parentUser?.id,
      } as any,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        parentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      } as any,
    });

    return NextResponse.json({
      success: true,
      student: {
        ...(student as any),
        // For backward compatibility in the UI
        parentName: (student as any).parentUser ? `${(student as any).parentUser.firstName} ${(student as any).parentUser.lastName}` : null,
        parentEmail: (student as any).parentUser?.email || null,
        parentPhone: (student as any).parentUser?.phone || null,
      },
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
