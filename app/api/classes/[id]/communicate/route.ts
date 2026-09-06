import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  requireAuth,
  authError,
  getTeacherIdForUser,
  tenantScope,
} from '@/lib/api-auth';

// Accetta sia { subject, body } (contratto) sia { subject, message } (client legacy)
const communicateSchema = z
  .object({
    subject: z.string().min(1, 'Oggetto richiesto').max(200),
    body: z.string().min(1).max(10000).optional(),
    message: z.string().min(1).max(10000).optional(),
    includeParents: z.boolean().optional().default(false),
  })
  .refine((d) => Boolean(d.body || d.message), {
    message: 'Contenuto richiesto',
  });

/**
 * POST /api/classes/[id]/communicate — invia una comunicazione agli studenti
 * della classe (e opzionalmente ai genitori). Wrapper sulla creazione
 * Message + MessageRecipient (stessa forma di /api/messages).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'],
    });

    const { id } = await params;
    const body = await request.json();
    const data = communicateSchema.parse(body);
    const content = (data.body ?? data.message)!;

    const cls = await prisma.class.findFirst({
      where: tenantScope(ctx, { id }),
      include: {
        students: {
          where: { isActive: true },
          include: {
            student: {
              select: {
                id: true,
                userId: true,
                parentUserId: true,
                guardians: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: 'Classe non trovata' }, { status: 404 });
    }

    // TEACHER: solo le classi di cui è titolare
    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId || cls.teacherId !== teacherId) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    // Destinatari: account studente + (opzionale) tutori/genitori
    const recipientIds = new Set<string>();
    for (const enrollment of cls.students) {
      const student = enrollment.student;
      if (student.userId) recipientIds.add(student.userId);
      if (data.includeParents) {
        if (student.parentUserId) recipientIds.add(student.parentUserId);
        for (const guardian of student.guardians) {
          recipientIds.add(guardian.userId);
        }
      }
    }
    // Mai auto-inviarsi il messaggio
    recipientIds.delete(ctx.userId);

    if (recipientIds.size === 0) {
      return NextResponse.json(
        { error: 'Nessun destinatario disponibile per questa classe' },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        title: data.subject,
        content,
        type: 'GROUP',
        sendEmail: true,
        sendSms: false,
        sendPush: true,
        emailSubject: data.subject,
        status: 'DRAFT',
        tenantId: cls.tenantId,
        senderId: ctx.userId,
        recipients: {
          create: Array.from(recipientIds).map((userId) => ({
            userId,
            emailStatus: 'SCHEDULED',
            smsStatus: 'DRAFT',
            pushStatus: 'SCHEDULED',
          })),
        },
      },
      include: {
        _count: { select: { recipients: true } },
      },
    });

    return NextResponse.json(
      { success: true, data: message },
      { status: 201 }
    );
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Class communicate error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
