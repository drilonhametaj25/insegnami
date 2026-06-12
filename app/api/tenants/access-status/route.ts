import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getTenantAccessCached } from '@/lib/tenant-access';

/**
 * Verdetto di accesso del tenant corrente, usato dal layout dashboard per
 * redirigere a /dashboard/billing quando il tenant è bloccato (trial scaduto,
 * pagamento fallito, abbonamento cancellato).
 *
 * Route ESENTE dall'enforcement (deve rispondere anche a tenant bloccati).
 */
export async function GET() {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role === 'SUPERADMIN' || !session.user.tenantId) {
      return NextResponse.json({ ok: true });
    }

    const verdict = await getTenantAccessCached(session.user.tenantId);
    return NextResponse.json(verdict);
  } catch (error) {
    console.error('Access status error:', error);
    // Fail-open lato UI: l'enforcement autoritativo resta sulle API dati
    return NextResponse.json({ ok: true });
  }
}
