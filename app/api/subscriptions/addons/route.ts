import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth, ADMIN_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ADDON_CATALOG, ADDON_TYPES } from '@/lib/billing/addons';
import { devPurchaseAddon, devRemoveAddon } from '@/lib/billing/dev-billing';
import { getEffectiveLimits, getStorageUsedBytes } from '@/lib/billing/limits';
import type { AddonType } from '@prisma/client';

const MutateSchema = z.object({
  type: z.enum(ADDON_TYPES as [AddonType, ...AddonType[]]),
  quantity: z.number().int().min(1).max(100).optional().default(1),
});

/** GET /api/subscriptions/addons — catalogo, add-on attivi, limiti effettivi, storage. */
export async function GET() {
  const session = await getAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const [active, limits, storageUsed] = await Promise.all([
    prisma.tenantAddon.findMany({ where: { tenantId, status: 'ACTIVE' } }),
    getEffectiveLimits(tenantId),
    getStorageUsedBytes(tenantId),
  ]);

  return NextResponse.json({
    catalog: Object.values(ADDON_CATALOG),
    active: active.map((a) => ({
      id: a.id,
      type: a.type,
      quantity: a.quantity,
      unitSize: a.unitSize,
      unitPrice: Number(a.unitPrice),
      monthlyTotal: Number(a.unitPrice) * a.quantity,
    })),
    limits,
    storage: {
      usedBytes: storageUsed,
      limitBytes: limits.storageBytes,
    },
  });
}

/** POST /api/subscriptions/addons — acquista/incrementa un add-on. */
export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = MutateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dati non validi', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, quantity } = parsed.data;
  const addon = await devPurchaseAddon({ tenantId: session.user.tenantId, type, quantity });
  const limits = await getEffectiveLimits(session.user.tenantId);

  return NextResponse.json({ success: true, addon: { ...addon, unitPrice: Number(addon.unitPrice) }, limits });
}

/** DELETE /api/subscriptions/addons — riduce/rimuove un add-on. */
export async function DELETE(request: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = MutateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dati non validi', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, quantity } = parsed.data;
  await devRemoveAddon({ tenantId: session.user.tenantId, type, quantity });
  const limits = await getEffectiveLimits(session.user.tenantId);

  return NextResponse.json({ success: true, limits });
}
