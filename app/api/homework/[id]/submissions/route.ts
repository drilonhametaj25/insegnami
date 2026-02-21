import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for student submission
const submissionSchema = z.object({
  content: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional().default([]),
});

// Validation schema for grading
const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(10).optional().nullable(),
  feedback: z.string().optional().nullable(),
});

// GET /api/homework/[id]/submissions - Get submissions for a homework
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: homeworkId } = await params;

    // Verify homework exists
    const homework = await prisma.homework.findFirst({
      where: {
        id: homeworkId,
        tenantId: session.user.tenantId,
      },
      include: {
        class: {
          include: {
            students: {
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
            },
          },
        },
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // Get all submissions
    const submissions = await prisma.homeworkSubmission.findMany({
      where: { homeworkId },
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
      orderBy: { submittedAt: 'desc' },
    });

    // For teachers/admins, also show students who haven't submitted
    if (['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      const submittedStudentIds = submissions.map((s) => s.studentId);
      const allStudents = homework.class.students.map((sc) => sc.student);
      const missingStudents = allStudents.filter(
        (s) => !submittedStudentIds.includes(s.id)
      );

      return NextResponse.json({
        homework: {
          id: homework.id,
          title: homework.title,
          dueDate: homework.dueDate,
        },
        submissions,
        missingSubmissions: missingStudents,
        statistics: {
          totalStudents: allStudents.length,
          submitted: submissions.length,
          missing: missingStudents.length,
          graded: submissions.filter((s) => s.grade !== null).length,
        },
      });
    }

    // For students/parents, just return submissions
    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('Homework submissions GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST /api/homework/[id]/submissions - Submit homework (student)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only students can submit homework
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'Solo gli studenti possono consegnare compiti' },
        { status: 403 }
      );
    }

    const { id: homeworkId } = await params;
    const body = await request.json();
    const validatedData = submissionSchema.parse(body);

    // Get student
    const student = await prisma.student.findFirst({
      where: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Studente non trovato' },
        { status: 404 }
      );
    }

    // Verify homework exists and is published
    const homework = await prisma.homework.findFirst({
      where: {
        id: homeworkId,
        tenantId: session.user.tenantId,
        isPublished: true,
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // Check if student is in the class
    const studentClass = await prisma.studentClass.findFirst({
      where: {
        studentId: student.id,
        classId: homework.classId,
      },
    });

    if (!studentClass) {
      return NextResponse.json(
        { error: 'Non sei iscritto a questa classe' },
        { status: 403 }
      );
    }

    // Check if already submitted (upsert)
    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: student.id,
        },
      },
      create: {
        homeworkId,
        studentId: student.id,
        content: validatedData.content,
        attachments: validatedData.attachments,
      },
      update: {
        content: validatedData.content,
        attachments: validatedData.attachments,
        submittedAt: new Date(),
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

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Homework submission POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// PUT /api/homework/[id]/submissions - Grade a submission (teacher)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only teachers and admins can grade
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: homeworkId } = await params;
    const body = await request.json();
    const { studentId, ...gradeData } = body;
    const validatedData = gradeSubmissionSchema.parse(gradeData);

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId è obbligatorio' },
        { status: 400 }
      );
    }

    // Verify homework exists
    const homework = await prisma.homework.findFirst({
      where: {
        id: homeworkId,
        tenantId: session.user.tenantId,
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: 'Compito non trovato' },
        { status: 404 }
      );
    }

    // Check if submission exists
    const existingSubmission = await prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
    });

    if (!existingSubmission) {
      return NextResponse.json(
        { error: 'Consegna non trovata' },
        { status: 404 }
      );
    }

    // Update with grade
    const updatedSubmission = await prisma.homeworkSubmission.update({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
      data: {
        grade: validatedData.grade,
        feedback: validatedData.feedback,
        gradedAt: validatedData.grade !== null ? new Date() : null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            userId: true,
            parentUserId: true,
          },
        },
      },
    });

    // Notify student and parent
    if (validatedData.grade !== null) {
      const notifications = [];
      if (updatedSubmission.student.userId) {
        notifications.push({
          tenantId: session.user.tenantId,
          userId: updatedSubmission.student.userId,
          title: 'Compito valutato',
          content: `Il tuo compito "${homework.title}" è stato valutato: ${validatedData.grade}/10`,
          type: 'GRADE' as const,
          priority: 'NORMAL' as const,
          sourceType: 'homeworkSubmission',
          sourceId: updatedSubmission.id,
          actionUrl: `/dashboard/homework/${homeworkId}`,
        });
      }
      if (updatedSubmission.student.parentUserId) {
        notifications.push({
          tenantId: session.user.tenantId,
          userId: updatedSubmission.student.parentUserId,
          title: 'Compito valutato',
          content: `Il compito di ${updatedSubmission.student.firstName} "${homework.title}" è stato valutato: ${validatedData.grade}/10`,
          type: 'GRADE' as const,
          priority: 'NORMAL' as const,
          sourceType: 'homeworkSubmission',
          sourceId: updatedSubmission.id,
          actionUrl: `/dashboard/homework/${homeworkId}`,
        });
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    }

    return NextResponse.json(updatedSubmission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Homework grade PUT error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
