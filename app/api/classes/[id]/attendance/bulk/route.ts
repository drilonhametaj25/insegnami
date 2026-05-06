import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getTeacherIdForUser, type AuthContext } from '@/lib/api-auth';

const BulkAttendanceSchema = z.object({
  attendance: z.array(z.object({
    studentId: z.string(),
    lessonId: z.string(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    notes: z.string().optional(),
  }))
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const classId = id;
    const body = await request.json();
    
    // Validate input
    const validatedData = BulkAttendanceSchema.parse(body);

    // Build where clause with tenant scoping and permission check
    const where: any = { id: classId };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // For teachers, only allow access to their own classes
    // SECURITY: Class.teacherId references Teacher.id, NOT User.id.
    if (session.user.role === 'TEACHER') {
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;
      const tid = await getTeacherIdForUser(ctx);
      where.teacherId = tid ?? '__no_teacher__';
    }

    const hasPermission = await prisma.class.findFirst({
      where
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Bulk upsert attendance records
    const results = await Promise.all(
      validatedData.attendance.map(async (record) => {
        return prisma.attendance.upsert({
          where: {
            lessonId_studentId: {
              lessonId: record.lessonId,
              studentId: record.studentId,
            }
          },
          update: {
            status: record.status,
            notes: record.notes,
            updatedAt: new Date(),
          },
          create: {
            studentId: record.studentId,
            lessonId: record.lessonId,
            status: record.status,
            notes: record.notes,
          },
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              }
            }
          }
        });
      })
    );

    return NextResponse.json({ 
      message: 'Attendance updated successfully',
      count: results.length,
      records: results
    });

  } catch (error) {
    console.error('Bulk attendance update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
