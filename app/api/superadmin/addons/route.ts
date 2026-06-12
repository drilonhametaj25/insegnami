import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ADDON_CATALOG } from '@/lib/billing/addons';
import { isStripeEnabled, isDevBilling } from '@/lib/billing/billing-mode';
import { syncAllToStripe } from '@/lib/billing/stripe-sync';
import { redis } from '@/lib/redis';

// Lock distribuito per la sync Stripe: due sync concorrenti creerebbero
// prodotti/prezzi duplicati (la sync è idempotente solo in sequenza).
const SYNC_LOCK_KEY = 'lock:stripe-sync';
const SYNC_LOCK_TTL_SECONDS = 10 * 60; // rete di sicurezza se manca la release

/**
 * GET /api/superadmin/addons
 * Catalogo add-on + stato sync Stripe (ID prodotto/prezzo, ultima sync).
 */
export async function GET() {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const rows = await prisma.addonCatalog.findMany();
    const byType = new Map(rows.map((r) => [r.type, r]));

    const addons = Object.values(ADDON_CATALOG).map((def) => {
      const row = byType.get(def.type);
      return {
        type: def.type,
        name: def.name,
        description: def.description,
        unitSize: def.unitSize,
        unitLabel: def.unitLabel,
        unitPrice: def.unitPrice,
        stripeProductId: row?.stripeProductId ?? null,
        stripePriceId: row?.stripePriceId ?? null,
        syncedAt: row?.syncedAt ?? null,
      };
    });

    return NextResponse.json({ addons, stripeEnabled: isStripeEnabled() });
  } catch (error) {
    console.error('superadmin addons GET error:', error);
    return NextResponse.json({ error: 'Errore nel caricamento add-on' }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/addons
 * Esegue la sync completa del catalogo commerciale su Stripe
 * (3 piani + 4 add-on), idempotente.
 */
export async function POST() {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    if (isDevBilling()) {
      return NextResponse.json(
        { error: 'Stripe non configurato (dev billing attivo): sync non necessaria.' },
        { status: 400 }
      );
    }

    // Lock NX: una sola sync alla volta. Se non acquisito, un'altra sync è in
    // corso (o il lock precedente non è ancora scaduto) → 409.
    const lockAcquired = await redis.setNX(SYNC_LOCK_KEY, String(Date.now()), SYNC_LOCK_TTL_SECONDS);
    if (!lockAcquired) {
      return NextResponse.json({ error: 'Sync già in corso' }, { status: 409 });
    }

    try {
      const results = await syncAllToStripe(prisma as any);
      return NextResponse.json({ success: true, results });
    } finally {
      await redis.del(SYNC_LOCK_KEY);
    }
  } catch (error) {
    console.error('superadmin addons sync error:', error);
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json({ error: 'Sync Stripe fallita', detail: message }, { status: 500 });
  }
}
