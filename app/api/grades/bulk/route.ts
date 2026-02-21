import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { GradeType } from '@prisma/client';

// Validation schema for bulk grades
const bulkGradeSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  periodId: z.string().optional().nullable(),
  type: z.nativeEnum(GradeType).default('WRITTEN'),
  description: z.string().optional().nullable(),
  date: z.string().transform((val) => new Date(val)),
  weight: z.number().min(0).max(5).optional().default(1.0),
  grades: z.array(z.object({
    studentId: z.string().min(1),
    value: z.number().min(0).max(10),
    notes: z.string().optional().nullable(),
  })),
});

// POST /api/grades/bulk - Create multiple grades at once
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and TEACHER can create grades
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = bulkGradeSchema.parse(body);

    // Get teacher ID
    let teacherId = body.teacherId;
    if (session.user.role === 'TEACHER') {
      if (!session.user.email) {
        return NextResponse.json({ error: 'Email utente non disponibile' }, { status: 400 });
      }
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
      });
      if (!teacher) {
        return NextResponse.json({ error: 'Docente non trovato' }, { status: 404 });
      }
      teacherId = teacher.id;
    }

    if (!teacherId) {
      return NextResponse.json({ error: 'teacherId è obbligatorio' }, { status: 400 });
    }

    // Verify class exists
    const classEntity = await prisma.class.findFirst({
      where: {
        id: validatedData.classId,
        tenantId: session.user.tenantId,
      },
    });

    if (!classEntity) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // Verify subject exists
    const subject = await prisma.subject.findFirst({
      where: {
        id: validatedData.subjectId,
        tenantId: session.user.tenantId,
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Materia non trovata' }, { status: 404 });
    }

    // Verify all students exist and belong to the class
    const studentIds = validatedData.grades.map((g) => g.studentId);
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: session.user.tenantId,
      },
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        { error: 'Alcuni studenti non trovati' },
        { status: 400 }
      );
    }

    // Create all grades in a transaction
    const createdGrades = await prisma.$transaction(async (tx) => {
      const grades = [];

      for (const gradeData of validatedData.grades) {
        const grade = await tx.grade.create({
          data: {
            tenantId: session.user.tenantId,
            studentId: gradeData.studentId,
            subjectId: validatedData.subjectId,
            classId: validatedData.classId,
            teacherId,
            periodId: validatedData.periodId,
            value: gradeData.value,
            weight: validatedData.weight,
            type: validatedData.type,
            description: validatedData.description,
            date: validatedData.date,
            notes: gradeData.notes,
            isVisible: true,
          },
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentCode: true,
                parentUserId: true,
              },
            },
          },
        });

        grades.push(grade);

        // Create notification for parent
        const student = students.find((s) => s.id === gradeData.studentId);
        if (student?.parentUserId) {
          await tx.notification.create({
            data: {
              tenantId: session.user.tenantId,
              userId: student.parentUserId,
              title: 'Nuovo voto registrato',
              content: `${student.firstName} ha ricevuto un voto ${gradeData.value} in ${subject.name}`,
              type: 'GRADE',
              priority: 'NORMAL',
              sourceType: 'grade',
              sourceId: grade.id,
              actionUrl: `/dashboard/students/${student.id}`,
            },
          });
        }
      }

      return grades;
    });

    return NextResponse.json({
      message: `${createdGrades.length} voti inseriti con successo`,
      grades: createdGrades,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Bulk grades POST error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
