import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { requireAuth, authError } from '@/lib/api-auth';
import { can } from '@/lib/permissions/matrix';

const noticeSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto'),
  content: z.string().min(1, 'Contenuto richiesto'),
  type: z.enum(['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'URGENT']).default('ANNOUNCEMENT'),
  // Ciclo di vita: le bozze restano visibili solo a chi gestisce gli avvisi
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  isPublic: z.boolean().default(true),
  targetRoles: z.array(z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'])).default(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isPinned: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
});

const NOTICE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type');
    const isPinned = searchParams.get('isPinned');
    const isUrgent = searchParams.get('isUrgent');
    const search = searchParams.get('search');
    const statusParam = searchParams.get('status');

    const skip = (page - 1) * limit;

    const role = session.user.role;
    // Chi gestisce (o crea) avvisi vede anche bozze/archiviati, senza filtro
    // audience/publishAt, con ricerca e filtro status espliciti.
    const isManager = can(role, 'manage', 'notice') || can(role, 'create', 'notice');

    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (isManager) {
      if (statusParam && (NOTICE_STATUSES as readonly string[]).includes(statusParam)) {
        where.status = statusParam;
      }
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ];
      }
    } else {
      // Ruoli non gestori: solo avvisi pubblicati, in finestra e per audience
      where.status = 'PUBLISHED';
      where.publishAt = { lte: new Date() };
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }, // Not expired
      ];
      where.targetRoles = {
        has: role,
      };
    }

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
    // Gate via matrice permessi: include DIRECTOR e SECRETARY (notice:create)
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'notice' } });

    const body = await request.json();
    const validatedData = noticeSchema.parse(body);

    // Teachers can only create announcements and reminders, not urgent notices
    if (ctx.role === 'TEACHER') {
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
        tenantId: ctx.tenantId,
        publishAt: validatedData.publishAt ? new Date(validatedData.publishAt) : new Date(),
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        // publishedAt tracciato solo alla pubblicazione effettiva
        publishedAt: validatedData.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    // Notifica i destinatari SOLO se l'avviso nasce pubblicato (le bozze non
    // notificano). In try/catch: un errore di notifica non blocca la create.
    if (notice.status === 'PUBLISHED') {
      try {
        const { NotificationService } = await import('@/lib/notification-service');
        await NotificationService.notifyNewAnnouncement(
          ctx.tenantId,
          notice.id,
          notice.title,
          notice.content,
          validatedData.targetRoles,
          validatedData.isUrgent || validatedData.type === 'URGENT',
        );
      } catch (notifyError) {
        console.error('Errore notifica nuovo avviso:', notifyError);
      }
    }

    return NextResponse.json(notice, { status: 201 });
  } catch (error) {
    const authRes = authError(error);
    if (authRes) return authRes;

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
