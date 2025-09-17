import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { DashboardService } from '@/lib/dashboard-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    
    const stats = await DashboardService.getAdminStats(tenantId);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
