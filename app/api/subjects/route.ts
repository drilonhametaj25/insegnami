import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema
const subjectSchema = z.object({
  name: z.string().min(1, 'Nome materia obbligatorio'),
  code: z.string().min(1, 'Codice materia obbligatorio').max(10, 'Codice massimo 10 caratteri'),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional(),
  weeklyHours: z.number().int().min(0).max(40).optional(),
  isActive: z.boolean().optional().default(true),
});

// GET /api/subjects - List subjects with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // All authenticated users can list subjects
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const all = searchParams.get('all') === 'true'; // Get all without pagination

    const skip = (page - 1) * limit;

    // Build where clause with tenant scoping
    const where: any = {};

    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Active filter
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    // Get subjects with pagination
    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        include: {
          teachers: {
            include: {
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              grades: true,
              homework: true,
              classSubjects: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        ...(all ? {} : { skip, take: limit }),
      }),
      prisma.subject.count({ where }),
    ]);

    // Transform subjects for response
    const transformedSubjects = subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      color: subject.color,
      icon: subject.icon,
      weeklyHours: subject.weeklyHours,
      isActive: subject.isActive,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
      teachers: subject.teachers.map((ts) => ({
        id: ts.teacher.id,
        firstName: ts.teacher.firstName,
        lastName: ts.teacher.lastName,
        email: ts.teacher.email,
      })),
      _count: subject._count,
    }));

    return NextResponse.json({
      subjects: transformedSubjects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Subjects GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/subjects - Create a new subject
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create subjects
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = subjectSchema.parse(body);

    // Check if subject code already exists for this tenant
    const existingSubject = await prisma.subject.findFirst({
      where: {
        code: validatedData.code,
        tenantId: session.user.tenantId,
      },
    });

    if (existingSubject) {
      return NextResponse.json(
        { error: 'Codice materia già esistente' },
        { status: 400 }
      );
    }

    // Create the subject
    const subject = await prisma.subject.create({
      data: {
        ...validatedData,
        tenantId: session.user.tenantId,
      },
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Subject POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
