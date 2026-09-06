import { NextRequest, NextResponse } from 'next/server';
import { getAuth, canManage } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Update parziale: stessi vincoli dello schema della collection
const updateGroupSchema = z.object({
  name: z.string().min(2, 'Il nome deve avere almeno 2 caratteri').optional(),
  description: z.string().nullable().optional(),
  memberIds: z.array(z.string().min(1)).min(1, 'Almeno un membro richiesto').optional(),
});

// Solo i gruppi CUSTOM esistono come righe DB: gli id sintetici
// (class_*, course_*, all_*) non sono modificabili/eliminabili.
async function findCustomGroup(id: string, tenantId: string) {
  return prisma.communicationGroup.findFirst({
    where: { id, tenantId },
    include: {
      memberships: { select: { userId: true } },
      _count: { select: { memberships: true } },
    },
  });
}

// GET /api/messages/groups/[id] — dettaglio gruppo custom (per il form di modifica)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    if (!canManage(session.user.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;
    const group = await findCustomGroup(id, session.user.tenantId);
    if (!group) {
      return NextResponse.json({ error: 'Gruppo non trovato' }, { status: 404 });
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        memberIds: group.memberships.map((m) => m.userId),
        memberCount: group._count.memberships,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching message group:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PUT /api/messages/groups/[id] — aggiorna nome/descrizione/membri
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    if (!canManage(session.user.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const tenantId = session.user.tenantId;
    const { id } = await params;

    const body = await request.json();
    const parsed = updateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const group = await findCustomGroup(id, tenantId);
    if (!group) {
      return NextResponse.json({ error: 'Gruppo non trovato' }, { status: 404 });
    }

    const { name, description, memberIds } = parsed.data;

    // Verifica FK cross-tenant sui nuovi membri (stessa logica della POST)
    let uniqueMemberIds: string[] | null = null;
    if (memberIds) {
      uniqueMemberIds = Array.from(new Set(memberIds));
      const memberships = await prisma.userTenant.findMany({
        where: { userId: { in: uniqueMemberIds }, tenantId },
        select: { userId: true },
      });
      const validUserIds = new Set(memberships.map((m) => m.userId));
      if (validUserIds.size !== uniqueMemberIds.length) {
        const invalidIds = uniqueMemberIds.filter((uid) => !validUserIds.has(uid));
        return NextResponse.json(
          { error: 'Utenti non validi: alcuni ID non appartengono a questo tenant', invalidIds },
          { status: 400 }
        );
      }
    }

    // Update + sostituzione membri in transazione (tutto o niente)
    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.communicationGroup.update({
        where: { id: group.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description ?? null } : {}),
        },
      });

      if (uniqueMemberIds) {
        await tx.communicationGroupMember.deleteMany({ where: { groupId: group.id } });
        await tx.communicationGroupMember.createMany({
          data: uniqueMemberIds.map((userId) => ({ groupId: group.id, userId })),
        });
      }

      return g;
    });

    return NextResponse.json({
      group: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        type: updated.type,
        memberCount: uniqueMemberIds ? uniqueMemberIds.length : group._count.memberships,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error('Error updating message group:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/messages/groups/[id] — elimina un gruppo custom (membri in cascata)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    if (!canManage(session.user.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;
    const group = await prisma.communicationGroup.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: 'Gruppo non trovato' }, { status: 404 });
    }

    await prisma.communicationGroup.delete({ where: { id: group.id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting message group:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
