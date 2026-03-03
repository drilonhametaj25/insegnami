import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { parsePaginationParams, withBodySizeLimit } from '@/lib/api-middleware';

// Schema for message validation
// BUG-030 fix: Add max-length validation
const messageSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto').max(200, 'Titolo max 200 caratteri'),
  content: z.string().min(1, 'Contenuto richiesto').max(10000, 'Contenuto max 10000 caratteri'),
  type: z.enum(['DIRECT', 'GROUP', 'BROADCAST', 'AUTOMATED']).default('DIRECT'),
  recipientIds: z.array(z.string().cuid()).min(1, 'Almeno un destinatario richiesto'),
  groupIds: z.array(z.string().cuid()).optional(),
  scheduledAt: z.string().datetime().optional(),
  sendEmail: z.boolean().default(true),
  sendSms: z.boolean().default(false),
  sendPush: z.boolean().default(true),
  emailTemplate: z.string().optional(),
  emailSubject: z.string().optional(),
  priority: z.number().min(0).max(2).default(0),
  isUrgent: z.boolean().default(false),
  requiresResponse: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // BUG-031 fix: Enforce pagination limits
    const { page, limit, skip } = parsePaginationParams(searchParams);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const urgent = searchParams.get('urgent') === 'true';
    const sent = searchParams.get('sent');

    // Build where clause based on user role and filters
    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (urgent) where.isUrgent = true;
    if (sent === 'true') where.sentAt = { not: null };
    if (sent === 'false') where.sentAt = null;

    // Role-based filtering
    if (session.user.role === 'TEACHER') {
      // Teachers can see messages they sent or received
      where.OR = [
        { senderId: session.user.id },
        { recipients: { some: { userId: session.user.id } } }
      ];
    } else if (session.user.role === 'STUDENT') {
      // Students can only see messages they received
      where.recipients = { some: { userId: session.user.id } };
    } else if (session.user.role === 'PARENT') {
      // Parents can see messages sent to themselves or their children
      // First get the student user IDs for this parent
      const studentRelations = await prisma.student.findMany({
        where: {
          parentUserId: session.user.id,
          tenantId: session.user.tenantId,
        },
        select: { userId: true }
      });

      const childUserIds = studentRelations
        .map(s => s.userId)
        .filter((id): id is string => id !== null);

      // Include parent's own ID and their children's IDs
      const allowedUserIds = [session.user.id, ...childUserIds];

      where.recipients = {
        some: { userId: { in: allowedUserIds } }
      };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              recipients: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // BUG-029 fix: Check payload size
    const sizeCheck = await withBodySizeLimit(request);
    if (sizeCheck) return sizeCheck;

    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins and teachers can create messages
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = messageSchema.parse(body);

    // Verify all recipients belong to the same tenant
    const recipients = await prisma.user.findMany({
      where: {
        id: { in: validatedData.recipientIds },
        tenants: {
          some: {
            tenantId: session.user.tenantId,
          },
        },
      },
    });

    if (recipients.length !== validatedData.recipientIds.length) {
      return NextResponse.json(
        { error: 'Alcuni destinatari non sono validi' },
        { status: 400 }
      );
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        type: validatedData.type,
        sendEmail: validatedData.sendEmail,
        sendSms: validatedData.sendSms,
        sendPush: validatedData.sendPush,
        emailTemplate: validatedData.emailTemplate,
        emailSubject: validatedData.emailSubject || validatedData.title,
        priority: validatedData.priority,
        isUrgent: validatedData.isUrgent,
        requiresResponse: validatedData.requiresResponse,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        status: validatedData.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        tenantId: session.user.tenantId,
        senderId: session.user.id,
        recipients: {
          create: validatedData.recipientIds.map(userId => ({
            userId,
            emailStatus: validatedData.sendEmail ? 'SCHEDULED' : 'DRAFT',
            smsStatus: validatedData.sendSms ? 'SCHEDULED' : 'DRAFT',
            pushStatus: validatedData.sendPush ? 'SCHEDULED' : 'DRAFT',
          })),
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        recipients: {
          include: {
            user: {
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
            recipients: true,
          },
        },
      },
    });

    // If not scheduled, process immediately
    if (!validatedData.scheduledAt) {
      // TODO: Add to email/sms/push queues
      // This would typically use BullMQ to queue the message for processing
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
