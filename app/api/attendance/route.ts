import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const attendanceSchema = z.object({
  lessonId: z.string().cuid(),
  studentId: z.string().cuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  notes: z.string().optional(),
  arrivedAt: z.string().datetime().optional(),
  leftAt: z.string().datetime().optional(),
});

const bulkAttendanceSchema = z.object({
  lessonId: z.string().cuid(),
  attendance: z.array(z.object({
    studentId: z.string().cuid(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    notes: z.string().optional(),
    arrivedAt: z.string().datetime().optional(),
    leftAt: z.string().datetime().optional(),
  })),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const lessonId = searchParams.get('lessonId');
    const studentId = searchParams.get('studentId');
    const classId = searchParams.get('classId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      lesson: {
        tenantId: session.user.tenantId,
      },
    };

    if (lessonId) where.lessonId = lessonId;
    if (studentId) where.studentId = studentId;
    if (classId) {
      where.lesson = {
        ...where.lesson,
        classId,
      };
    }

    if (startDate || endDate) {
      where.lesson = {
        ...where.lesson,
        startTime: {},
      };
      if (startDate) where.lesson.startTime.gte = new Date(startDate);
      if (endDate) where.lesson.startTime.lte = new Date(endDate);
    }

    // Role-based filtering
    if (session.user.role === 'TEACHER') {
      where.lesson = {
        ...where.lesson,
        teacherId: session.user.id,
      };
    } else if (session.user.role === 'STUDENT') {
      where.student = {
        email: session.user.email,
      };
    } else if (session.user.role === 'PARENT') {
      // Parents can only see their children's attendance
      where.student = {
        parentEmail: session.user.email,
      };
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  course: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
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
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentCode: true,
            },
          },
        },
        orderBy: { lesson: { startTime: 'desc' } },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      attendance,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only teachers and admins can mark attendance
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();

    // Check if it's bulk attendance or single attendance
    const isBulk = Array.isArray(body.attendance);
    
    if (isBulk) {
      const validatedData = bulkAttendanceSchema.parse(body);
      
      // Verify lesson belongs to tenant and teacher (if teacher role)
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: validatedData.lessonId,
          tenantId: session.user.tenantId,
          ...(session.user.role === 'TEACHER' && { teacherId: session.user.id }),
        },
      });

      if (!lesson) {
        return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
      }

      // Verify all students belong to the class
      const classStudents = await prisma.studentClass.findMany({
        where: {
          classId: lesson.classId,
          studentId: {
            in: validatedData.attendance.map(a => a.studentId),
          },
        },
      });

      if (classStudents.length !== validatedData.attendance.length) {
        return NextResponse.json(
          { error: 'Alcuni studenti non appartengono a questa classe' },
          { status: 400 }
        );
      }

      // Create or update attendance records
      const attendanceRecords = await Promise.all(
        validatedData.attendance.map(async (attendanceData) => {
          return prisma.attendance.upsert({
            where: {
              lessonId_studentId: {
                lessonId: validatedData.lessonId,
                studentId: attendanceData.studentId,
              },
            },
            update: {
              status: attendanceData.status,
              notes: attendanceData.notes,
              arrivedAt: attendanceData.arrivedAt ? new Date(attendanceData.arrivedAt) : null,
              leftAt: attendanceData.leftAt ? new Date(attendanceData.leftAt) : null,
            },
            create: {
              lessonId: validatedData.lessonId,
              studentId: attendanceData.studentId,
              status: attendanceData.status,
              notes: attendanceData.notes,
              arrivedAt: attendanceData.arrivedAt ? new Date(attendanceData.arrivedAt) : null,
              leftAt: attendanceData.leftAt ? new Date(attendanceData.leftAt) : null,
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
            },
          });
        })
      );

      return NextResponse.json(attendanceRecords, { status: 201 });
    } else {
      // Single attendance record
      const validatedData = attendanceSchema.parse(body);

      // Verify lesson belongs to tenant and teacher (if teacher role)
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: validatedData.lessonId,
          tenantId: session.user.tenantId,
          ...(session.user.role === 'TEACHER' && { teacherId: session.user.id }),
        },
      });

      if (!lesson) {
        return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
      }

      // Verify student belongs to the class
      const studentClass = await prisma.studentClass.findFirst({
        where: {
          classId: lesson.classId,
          studentId: validatedData.studentId,
        },
      });

      if (!studentClass) {
        return NextResponse.json(
          { error: 'Lo studente non appartiene a questa classe' },
          { status: 400 }
        );
      }

      const attendance = await prisma.attendance.upsert({
        where: {
          lessonId_studentId: {
            lessonId: validatedData.lessonId,
            studentId: validatedData.studentId,
          },
        },
        update: {
          status: validatedData.status,
          notes: validatedData.notes,
          arrivedAt: validatedData.arrivedAt ? new Date(validatedData.arrivedAt) : null,
          leftAt: validatedData.leftAt ? new Date(validatedData.leftAt) : null,
        },
        create: {
          lessonId: validatedData.lessonId,
          studentId: validatedData.studentId,
          status: validatedData.status,
          notes: validatedData.notes,
          arrivedAt: validatedData.arrivedAt ? new Date(validatedData.arrivedAt) : null,
          leftAt: validatedData.leftAt ? new Date(validatedData.leftAt) : null,
        },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentCode: true,
            },
          },
        },
      });

      return NextResponse.json(attendance, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating/updating attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
