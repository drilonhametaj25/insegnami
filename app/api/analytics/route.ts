import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import { requireAuth, authError } from '@/lib/api-auth';
import { computeAnalytics, type AnalyticsType } from '@/lib/analytics/compute';

const VALID_TYPES: AnalyticsType[] = ['overview', 'attendance', 'financial', 'trends'];

/**
 * GET /api/analytics?type=&period=&startDate=&endDate=
 * startDate/endDate espliciti (ISO) hanno priorità su period (giorni).
 * Gated dalla feature di piano 'analytics' oltre alla permission.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({
      permission: { action: 'read', resource: 'analytics' },
      feature: 'analytics',
    });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const type = (searchParams.get('type') || 'overview') as AnalyticsType;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const tenantId = ctx.tenantId;

    // Range esplicito prioritario sul period
    let startDate: Date;
    let endDate: Date;
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
        return NextResponse.json({ error: 'Intervallo date non valido' }, { status: 400 });
      }
    } else {
      endDate = new Date();
      const days = parseInt(period);
      startDate = subDays(endDate, isNaN(days) ? 30 : days);
    }

    const data = await computeAnalytics(type, tenantId, startDate, endDate);
    return NextResponse.json(data);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
