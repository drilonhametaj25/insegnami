import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/reports/[id] - Get single report
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    const report = await prisma.report.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Report GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/reports/[id] - Delete report
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can delete reports
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Ensure the report belongs to the current tenant before deleting
    const report = await prisma.report.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await prisma.report.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
