import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { isPackageLowOnHours } from '@/lib/hours-package-service';
import { sendEmail } from '@/lib/email';

async function sendLowHoursEmail(pkg: any) {
  const remainingHours = parseFloat(pkg.remainingHours.toString());
  const totalHours = parseFloat(pkg.totalHours.toString());
  const percentageRemaining = ((remainingHours / totalHours) * 100).toFixed(0);

  const subject = `⚠️ Pacchetto Ore in Esaurimento - ${pkg.course.name}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">⚠️ Attenzione: Pacchetto Ore in Esaurimento</h2>
      
      <p>Gentile ${pkg.student.firstName} ${pkg.student.lastName},</p>
      
      <p>Ti informiamo che il tuo pacchetto ore per il corso <strong>${pkg.course.name}</strong> sta per esaurirsi.</p>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #92400e;">Riepilogo Ore</h3>
        <p style="margin: 5px 0;"><strong>Ore Rimanenti:</strong> ${remainingHours.toFixed(1)} ore</p>
        <p style="margin: 5px 0;"><strong>Ore Totali:</strong> ${totalHours.toFixed(1)} ore</p>
        <p style="margin: 5px 0;"><strong>Percentuale Rimanente:</strong> ${percentageRemaining}%</p>
      </div>
      
      <p>Ti consigliamo di contattare la segreteria per rinnovare il tuo pacchetto ore e continuare le lezioni senza interruzioni.</p>
      
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Visualizza Dashboard
        </a>
      </p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      
      <p style="color: #6b7280; font-size: 12px;">
        Questo è un messaggio automatico. Per qualsiasi domanda, contatta la segreteria.
      </p>
    </div>
  `;

  await sendEmail({
    to: pkg.student.email,
    subject,
    html,
  });
}

const attendanceUpdateSchema = z.object({
  studentId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  hoursAttended: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can update attendance
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = attendanceUpdateSchema.parse(body);
    const { id: lessonId } = await params;

    // Verify lesson exists and belongs to tenant
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        tenantId: session.user.tenantId,
      },
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Teachers can only update attendance for their own lessons
    if (session.user.role === 'TEACHER' && lesson.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Verify student exists and is enrolled in the class
    const enrollment = await prisma.studentClass.findFirst({
      where: {
        studentId: validatedData.studentId,
        classId: lesson.classId,
        isActive: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Studente non iscritto a questa classe' },
        { status: 400 }
      );
    }

    // Calculate lesson duration in hours
    const lessonDurationMs = new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime();
    const lessonDurationHours = lessonDurationMs / (1000 * 60 * 60);

    // Determine hours attended
    let hoursAttended = validatedData.hoursAttended;
    
    // If not provided, use full duration for PRESENT, zero for ABSENT
    if (hoursAttended === null || hoursAttended === undefined) {
      if (validatedData.status === 'PRESENT') {
        hoursAttended = lessonDurationHours;
      } else if (validatedData.status === 'LATE') {
        // For late, default to half the duration if not specified
        hoursAttended = lessonDurationHours / 2;
      } else {
        hoursAttended = 0;
      }
    }

    // Upsert attendance record
    const attendance = await prisma.attendance.upsert({
      where: {
        lessonId_studentId: {
          lessonId: lessonId,
          studentId: validatedData.studentId,
        },
      },
      update: {
        status: validatedData.status,
        hoursAttended: hoursAttended ? new Decimal(hoursAttended) : null,
        notes: validatedData.notes,
      },
      create: {
        lessonId: lessonId,
        studentId: validatedData.studentId,
        status: validatedData.status,
        hoursAttended: hoursAttended ? new Decimal(hoursAttended) : null,
        notes: validatedData.notes,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // If student has hours remaining and attended, deduct hours
    if (hoursAttended && hoursAttended > 0 && lesson.class.courseId) {
      // Find active hours package for this student and course
      const hoursPackage = await prisma.hoursPackage.findFirst({
        where: {
          studentId: validatedData.studentId,
          courseId: lesson.class.courseId,
          isActive: true,
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: new Date() } },
          ],
        },
        orderBy: {
          purchaseDate: 'asc', // Use oldest package first
        },
      });

      if (hoursPackage) {
        const newRemainingHours = Math.max(
          0,
          parseFloat(hoursPackage.remainingHours.toString()) - hoursAttended
        );

        const updatedPackage = await prisma.hoursPackage.update({
          where: { id: hoursPackage.id },
          data: {
            remainingHours: new Decimal(newRemainingHours),
            // Deactivate if no hours remaining
            isActive: newRemainingHours > 0,
          },
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            course: {
              select: {
                name: true,
              },
            },
          },
        });

        // Check if package is now low on hours and send notification
        if (isPackageLowOnHours(newRemainingHours, parseFloat(hoursPackage.totalHours.toString()))) {
          // Send email notification asynchronously (don't block the response)
          if (updatedPackage.student.email) {
            sendLowHoursEmail(updatedPackage).catch((err: Error) => 
              console.error('Failed to send low hours email:', err)
            );
          }
        }
      }
    }

    return NextResponse.json(attendance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id: lessonId } = await params;

    // Verify lesson exists and belongs to tenant
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        tenantId: session.user.tenantId,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Get all attendance records for this lesson
    const attendance = await prisma.attendance.findMany({
      where: {
        lessonId: lessonId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
