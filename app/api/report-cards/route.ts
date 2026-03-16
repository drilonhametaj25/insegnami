import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createReportCardSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
  periodId: z.string().min(1),
});

// GET /api/report-cards - List report cards with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const periodId = searchParams.get('periodId');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause based on role
    const where: any = {};

    // Tenant filtering
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Role-based access control
    if (session.user.role === 'STUDENT') {
      // Students can only see their own PUBLISHED report cards
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      where.studentId = student.id;
      where.status = 'PUBLISHED';
    } else if (session.user.role === 'PARENT') {
      // Parents can only see their child's PUBLISHED report cards
      const child = await prisma.student.findFirst({
        where: { parentUserId: session.user.id },
      });
      if (!child) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }
      where.studentId = child.id;
      where.status = 'PUBLISHED';
    } else if (session.user.role === 'TEACHER' && session.user.email) {
      // Teachers can see report cards for their classes
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
        include: { classes: { select: { id: true } } },
      });
      if (teacher) {
        where.classId = { in: teacher.classes.map((c: { id: string }) => c.id) };
      }
    }
    // ADMIN and SUPERADMIN can see all

    // Apply filters
    if (classId) where.classId = classId;
    if (periodId) where.periodId = periodId;
    if (studentId && session.user.role !== 'STUDENT' && session.user.role !== 'PARENT') {
      where.studentId = studentId;
    }
    if (status && session.user.role !== 'STUDENT' && session.user.role !== 'PARENT') {
      where.status = status;
    }

    const [reportCards, total] = await Promise.all([
      prisma.reportCard.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentCode: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          period: {
            select: {
              id: true,
              name: true,
              type: true,
              academicYear: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          entries: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  color: true,
                },
              },
            },
          },
          _count: {
            select: { entries: true },
          },
        },
        orderBy: [
          { period: { startDate: 'desc' } },
          { student: { lastName: 'asc' } },
        ],
        skip,
        take: limit,
      }),
      prisma.reportCard.count({ where }),
    ]);

    // Calculate stats
    const stats = await prisma.reportCard.groupBy({
      by: ['status'],
      where: {
        tenantId: session.user.tenantId,
        ...(classId ? { classId } : {}),
        ...(periodId ? { periodId } : {}),
      },
      _count: true,
    });

    const statusCounts = stats.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      data: reportCards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        draft: statusCounts.DRAFT || 0,
        inReview: statusCounts.IN_REVIEW || 0,
        approved: statusCounts.APPROVED || 0,
        published: statusCounts.PUBLISHED || 0,
        archived: statusCounts.ARCHIVED || 0,
      },
    });
  } catch (error) {
    console.error('Report cards GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/report-cards - Create a new report card
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can create report cards
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = createReportCardSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { studentId, classId, periodId } = validation.data;

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Studente non trovato' }, { status: 404 });
    }

    // Check if report card already exists for this student/class/period
    const existing = await prisma.reportCard.findFirst({
      where: { studentId, classId, periodId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Pagella già esistente per questo studente, classe e periodo' },
        { status: 409 }
      );
    }

    // Get all subjects for this class
    const classSubjects = await prisma.classSubject.findMany({
      where: { classId },
      include: { subject: true },
    });

    // Get all grades for this student in this period
    const grades = await prisma.grade.findMany({
      where: {
        studentId,
        classId,
        periodId,
      },
      include: {
        subject: true,
      },
    });

    // Calculate averages per subject
    const subjectAverages: Record<string, {
      oral: number[];
      written: number[];
      practical: number[];
      all: { value: number; weight: number }[];
    }> = {};

    for (const grade of grades) {
      const subjectId = grade.subjectId;
      if (!subjectAverages[subjectId]) {
        subjectAverages[subjectId] = { oral: [], written: [], practical: [], all: [] };
      }

      const value = Number(grade.value);
      const weight = Number(grade.weight);

      subjectAverages[subjectId].all.push({ value, weight });

      if (grade.type === 'ORAL') {
        subjectAverages[subjectId].oral.push(value);
      } else if (grade.type === 'WRITTEN' || grade.type === 'TEST') {
        subjectAverages[subjectId].written.push(value);
      } else if (grade.type === 'PRACTICAL') {
        subjectAverages[subjectId].practical.push(value);
      }
    }

    // Create report card with entries
    const reportCard = await prisma.reportCard.create({
      data: {
        tenantId: student.tenantId,
        studentId,
        classId,
        periodId,
        status: 'DRAFT',
        entries: {
          create: classSubjects.map((cs) => {
            const avg = subjectAverages[cs.subjectId];

            const calcAvg = (arr: number[]) =>
              arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;

            const calcWeightedAvg = (items: { value: number; weight: number }[]) => {
              if (items.length === 0) return null;
              const totalWeight = items.reduce((s, i) => s + i.weight, 0);
              const totalValue = items.reduce((s, i) => s + i.value * i.weight, 0);
              return totalWeight > 0 ? Math.round((totalValue / totalWeight) * 100) / 100 : null;
            };

            const averageOral = avg ? calcAvg(avg.oral) : null;
            const averageWritten = avg ? calcAvg(avg.written) : null;
            const averagePractical = avg ? calcAvg(avg.practical) : null;
            const overallAverage = avg ? calcWeightedAvg(avg.all) : null;

            // Default final grade to overall average or 0
            const finalGrade = overallAverage || 0;

            return {
              subjectId: cs.subjectId,
              finalGrade,
              averageOral,
              averageWritten,
              averagePractical,
              overallAverage,
            };
          }),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        period: {
          select: {
            id: true,
            name: true,
            type: true,
            academicYear: {
              select: { name: true },
            },
          },
        },
        entries: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(reportCard, { status: 201 });
  } catch (error) {
    console.error('Report card POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
