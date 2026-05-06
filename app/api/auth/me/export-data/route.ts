import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { exportUserData } from '@/lib/gdpr/export';

/**
 * POST /api/auth/me/export-data — GDPR Art.20 portability.
 * Streams a JSON file with everything we hold about the authenticated user.
 *
 * POST (not GET) because: (a) it can be expensive on accounts with deep
 * history, (b) browsers can be tempted to prefetch GETs, (c) auditing
 * it as a "request" reads cleaner.
 */
export async function POST() {
  const session = await getAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const data = await exportUserData(session.user.id);
  const filename = `insegnami-my-data-${session.user.tenantId}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
