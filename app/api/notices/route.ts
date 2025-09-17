import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const noticeSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto'),
  content: z.string().min(1, 'Contenuto richiesto'),
  type: z.enum(['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'URGENT']).default('ANNOUNCEMENT'),
  isPublic: z.boolean().default(true),
  targetRoles: z.array(z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'])).default(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isPinned: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
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
    const type = searchParams.get('type');
    const isPinned = searchParams.get('isPinned');
    const isUrgent = searchParams.get('isUrgent');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantId: session.user.tenantId,
      publishAt: { lte: new Date() }, // Only published notices
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }, // Not expired
      ],
    };

    // Filter by user role
    where.targetRoles = {
      has: session.user.role,
    };

    if (type) where.type = type;
    if (isPinned === 'true') where.isPinned = true;
    if (isUrgent === 'true') where.isUrgent = true;

    const [notices, total] = await Promise.all([
      prisma.notice.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { isUrgent: 'desc' },
          { publishAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.notice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      notices,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching notices:', error);
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

    // Only admins and teachers can create notices
    if (!['ADMIN', 'TEACHER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = noticeSchema.parse(body);

    // Teachers can only create announcements and reminders, not urgent notices
    if (session.user.role === 'TEACHER') {
      if (validatedData.type === 'URGENT' || validatedData.isUrgent) {
        return NextResponse.json(
          { error: 'Solo gli amministratori possono creare avvisi urgenti' },
          { status: 403 }
        );
      }
      if (validatedData.isPinned) {
        return NextResponse.json(
          { error: 'Solo gli amministratori possono creare avvisi in evidenza' },
          { status: 403 }
        );
      }
    }

    const notice = await prisma.notice.create({
      data: {
        ...validatedData,
        tenantId: session.user.tenantId,
        publishAt: validatedData.publishAt ? new Date(validatedData.publishAt) : new Date(),
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      },
    });

    return NextResponse.json(notice, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating notice:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
