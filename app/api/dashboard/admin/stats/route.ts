import { NextRequest, NextResponse } from 'next/server';
import { DashboardService } from '@/lib/dashboard-service';
import { requireAuth, authError } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'analytics' } });

    const stats = await DashboardService.getAdminStats(ctx.tenantId);

    return NextResponse.json(stats);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
