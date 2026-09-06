import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkTeacherLimit } from '@/lib/plan-limits';
import { getPublicErrorMessage } from '@/lib/api-middleware';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { generateTeacherCode } from '@/lib/user-profile-sync';

// GET /api/teachers - List teachers with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Ruoli amministrativi (ADMIN/DIRECTOR/SECRETARY/SUPERADMIN) + TEACHER
    // (per il docente la select è ridotta, vedi sotto)
    const isTeacherRole = session.user.role === 'TEACHER';
    if (!isAdminRole(session.user.role) && !isTeacherRole) {
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

    // Get teachers with pagination.
    // TEACHER: select ridotta — niente phone/hourlyRate/dati contrattuali.
    const [teachers, total] = await Promise.all([
      isTeacherRole
        ? prisma.teacher.findMany({
            where,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              subjects: {
                select: {
                  subject: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: {
              lastName: 'asc',
            },
            skip,
            take: limit,
          })
        : prisma.teacher.findMany({
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
    const transformedTeachers = isTeacherRole
      ? (teachers as any[]).map((teacher) => ({
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          subjects: teacher.subjects,
        }))
      : (teachers as any[]).map((teacher) => ({
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

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only ADMIN can create teachers
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check plan limits (skip for SUPERADMIN)
    if (session.user.role !== 'SUPERADMIN') {
      const limitCheck = await checkTeacherLimit(session.user.tenantId);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: limitCheck.message,
            limitReached: true,
            current: limitCheck.current,
            limit: limitCheck.limit,
          },
          { status: 403 }
        );
      }
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
      tenantId,
      createAccount,
      password,
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

    // BUG-049 fix: Generic error message to prevent user enumeration
    if (existingTeacher) {
      return NextResponse.json(
        { error: 'Impossibile creare insegnante. Verifica i dati e riprova.' },
        { status: 400 }
      );
    }

    // Generatore condiviso (lib/user-profile-sync): sequenza per-tenant con
    // retry anti-collisione sul vincolo @@unique([tenantId, teacherCode])
    const teacherCode = await generateTeacherCode(prisma, targetTenantId);

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

    // Opzionale: account di accesso (User + UserTenant TEACHER + link
    // Teacher.userId). Stesso flusso di POST /api/students: password fornita
    // → login reale; assente → password casuale (attivabile in seguito).
    let teacherUserId: string | null = null;
    if (createAccount) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Impossibile creare insegnante. Verifica i dati e riprova.' },
          { status: 400 }
        );
      }

      if (password && String(password).length < 8) {
        return NextResponse.json(
          { error: 'La password deve avere almeno 8 caratteri' },
          { status: 400 }
        );
      }

      const rawPassword = password
        ? String(password)
        : `${Math.random().toString(36).slice(2)}A1!`;
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      const teacherUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone: phone || null,
          status: 'ACTIVE',
          emailVerified: password ? new Date() : null,
        } as any,
      });
      teacherUserId = teacherUser.id;

      await prisma.userTenant.create({
        data: {
          userId: teacherUser.id,
          tenantId: targetTenantId,
          role: 'TEACHER',
        },
      });
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
        ...(teacherUserId ? { userId: teacherUserId } : {}),
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

  } catch (error: any) {
    // Collisione residua sul vincolo unico per-tenant (teacherCode/email):
    // 409 esplicito invece di 500 generico
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflitto: codice insegnante o email già esistenti, riprova.' },
        { status: 409 }
      );
    }
    // BUG-050 fix: Use generic error message to prevent info disclosure
    return NextResponse.json(
      { error: getPublicErrorMessage(error, 'Errore durante la creazione dell\'insegnante') },
      { status: 500 }
    );
  }
}
