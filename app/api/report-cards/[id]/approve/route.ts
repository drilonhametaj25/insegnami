import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { ReportCardStatus } from '@prisma/client';

const approveSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'publish', 'archive']),
  comment: z.string().optional(),
});

// Workflow transitions
const WORKFLOW_TRANSITIONS: Record<string, {
  from: ReportCardStatus[];
  to: ReportCardStatus;
  allowedRoles: string[];
}> = {
  submit: {
    from: ['DRAFT'],
    to: 'IN_REVIEW',
    allowedRoles: ['TEACHER', 'ADMIN', 'SUPERADMIN'],
  },
  approve: {
    from: ['IN_REVIEW'],
    to: 'APPROVED',
    allowedRoles: ['ADMIN', 'SUPERADMIN'],
  },
  reject: {
    from: ['IN_REVIEW'],
    to: 'DRAFT',
    allowedRoles: ['ADMIN', 'SUPERADMIN'],
  },
  publish: {
    from: ['APPROVED'],
    to: 'PUBLISHED',
    allowedRoles: ['ADMIN', 'SUPERADMIN'],
  },
  archive: {
    from: ['PUBLISHED'],
    to: 'ARCHIVED',
    allowedRoles: ['ADMIN', 'SUPERADMIN'],
  },
};

// POST /api/report-cards/[id]/approve - Workflow state transitions
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

    const body = await request.json();
    const validation = approveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { action, comment } = validation.data;

    // Get workflow transition rules
    const transition = WORKFLOW_TRANSITIONS[action];
    if (!transition) {
      return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
    }

    // Check role permission
    if (!transition.allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Non hai i permessi per eseguire questa azione' },
        { status: 403 }
      );
    }

    // Find report card
    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentUserId: true,
          },
        },
        class: {
          select: { name: true },
        },
        period: {
          select: { name: true },
        },
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Pagella non trovata' }, { status: 404 });
    }

    // Check if transition is valid from current status
    if (!transition.from.includes(reportCard.status)) {
      return NextResponse.json(
        {
          error: `Non è possibile eseguire l'azione "${action}" dallo stato "${reportCard.status}"`,
        },
        { status: 400 }
      );
    }

    // For teachers, check they have access to this class
    if (session.user.role === 'TEACHER' && session.user.email) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email,
          tenantId: session.user.tenantId,
        },
        include: { classes: { select: { id: true } } },
      });
      if (!teacher || !teacher.classes.some((c: { id: string }) => c.id === reportCard.classId)) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
    }

    // Update report card status
    const updateData: any = {
      status: transition.to,
    };

    // Set approval fields for certain transitions
    if (action === 'approve' || action === 'publish') {
      updateData.approvedBy = session.user.id;
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.reportCard.update({
      where: { id },
      data: updateData,
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

    // Send notification to parent when published
    if (action === 'publish' && reportCard.student.parentUserId) {
      try {
        await prisma.notification.create({
          data: {
            tenantId: reportCard.tenantId,
            userId: reportCard.student.parentUserId,
            title: 'Nuova pagella disponibile',
            content: `La pagella di ${reportCard.student.firstName} ${reportCard.student.lastName} per il periodo "${reportCard.period.name}" è ora disponibile.`,
            type: 'REPORT_CARD',
            priority: 'HIGH',
          },
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    // Create audit log
    try {
      if (session.user.id) {
        await prisma.auditLog.create({
          data: {
            tenantId: reportCard.tenantId,
            userId: session.user.id,
            action: `REPORT_CARD_${action.toUpperCase()}`,
            entity: 'ReportCard',
            entityId: id,
            oldData: { status: reportCard.status },
            newData: { status: transition.to, comment },
          },
        });
      }
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return NextResponse.json({
      success: true,
      action,
      previousStatus: reportCard.status,
      newStatus: transition.to,
      reportCard: updated,
    });
  } catch (error) {
    console.error('Report card approve error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
