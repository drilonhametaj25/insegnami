import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/classes/[id]/attendance - Get attendance data for a class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const studentId = searchParams.get('studentId');

    // Verify class exists and user has access
    const classWhere: any = { id };
    if (session.user.role !== 'SUPERADMIN') {
      classWhere.tenantId = session.user.tenantId;
    }

    // For teachers, verify they teach this class
    if (session.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher) {
        classWhere.teacherId = teacher.id;
      }
    }

    const classExists = await prisma.class.findFirst({
      where: classWhere,
    });

    if (!classExists) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Build attendance query
    const attendanceWhere: any = {
      lesson: {
        classId: id,
      },
    };

    if (dateFrom || dateTo) {
      attendanceWhere.lesson = {
        ...attendanceWhere.lesson,
        startTime: {},
      };
      
      if (dateFrom) {
        attendanceWhere.lesson.startTime.gte = new Date(dateFrom);
      }
      if (dateTo) {
        attendanceWhere.lesson.startTime.lte = new Date(dateTo);
      }
    }

    if (studentId) {
      attendanceWhere.studentId = studentId;
    }

    const attendance = await prisma.attendance.findMany({
      where: attendanceWhere,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentCode: true,
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            room: true,
          },
        },
      },
      orderBy: [
        { lesson: { startTime: 'desc' } },
        { student: { lastName: 'asc' } },
      ],
    });

    // Group by student for summary
    const studentSummary = attendance.reduce((acc: any, record) => {
      const studentId = record.student.id;
      if (!acc[studentId]) {
        acc[studentId] = {
          student: record.student,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          percentage: 0,
        };
      }
      
      acc[studentId].total++;
      acc[studentId][record.status.toLowerCase()]++;
      acc[studentId].percentage = Math.round(
        (acc[studentId].present / acc[studentId].total) * 100
      );
      
      return acc;
    }, {});

    return NextResponse.json({
      attendance,
      summary: Object.values(studentSummary),
    });

  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/classes/[id]/attendance - Record attendance for a lesson
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only teachers and admins can record attendance
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { lessonId, attendanceRecords } = body;

    // Validate input
    if (!lessonId || !Array.isArray(attendanceRecords)) {
      return NextResponse.json(
        { error: 'Missing lessonId or attendanceRecords' },
        { status: 400 }
      );
    }

    // Verify lesson belongs to class and user has access
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        classId: id,
        ...(session.user.role !== 'SUPERADMIN' && {
          class: { tenantId: session.user.tenantId },
        }),
      },
      include: {
        class: {
          include: {
            students: {
              where: { isActive: true },
              select: { studentId: true },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // For teachers, verify they teach this class
    if (session.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      
      if (!teacher || lesson.class.teacherId !== teacher.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Validate attendance records
    const validStudentIds = lesson.class.students.map(s => s.studentId);
    const invalidRecords = attendanceRecords.filter(
      (record: any) => !validStudentIds.includes(record.studentId)
    );

    if (invalidRecords.length > 0) {
      return NextResponse.json(
        { error: 'Invalid student IDs in attendance records' },
        { status: 400 }
      );
    }

    // Validate status values
    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    const invalidStatuses = attendanceRecords.filter(
      (record: any) => !validStatuses.includes(record.status)
    );

    if (invalidStatuses.length > 0) {
      return NextResponse.json(
        { error: 'Invalid status values in attendance records' },
        { status: 400 }
      );
    }

    // Use transaction to update attendance
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing attendance for this lesson
      await tx.attendance.deleteMany({
        where: {
          lessonId,
        },
      });

      // Create new attendance records
      const createdRecords = await Promise.all(
        attendanceRecords.map((record: any) =>
          tx.attendance.create({
            data: {
              lessonId,
              studentId: record.studentId,
              status: record.status,
              notes: record.notes || null,
            },
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  studentCode: true,
                },
              },
            },
          })
        )
      );

      return createdRecords;
    });

    return NextResponse.json({
      message: 'Attendance recorded successfully',
      attendance: result,
    });

  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
