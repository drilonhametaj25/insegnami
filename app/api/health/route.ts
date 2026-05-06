import { NextResponse } from 'next/server';
import { getServiceHealth } from '@/lib/queue/health';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — uptime probe.
 * Public (no auth) so external monitors can hit it. Checks DB + Redis,
 * returns 200 when both healthy, 503 when degraded.
 */
export async function GET() {
  const health = await getServiceHealth();
  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
