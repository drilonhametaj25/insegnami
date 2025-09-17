import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type ReportType = 'ATTENDANCE' | 'FINANCIAL' | 'PROGRESS' | 'OVERVIEW' | 'CLASS_ANALYTICS' | 'TEACHER_PERFORMANCE';
type ReportPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as ReportType | null;
    const period = searchParams.get('period') as ReportPeriod | null;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get tenant ID (in production, get from session or middleware)
    const tenantId = '1'; // For demo purposes

    // For now, return mock data since the Report model is not fully ready
    const mockReports = [
      {
        id: '1',
        tenantId,
        title: 'Monthly Attendance Report',
        type: 'ATTENDANCE',
        period: 'MONTHLY',
        startDate: new Date(2024, 11, 1),
        endDate: new Date(2024, 11, 31),
        data: { attendanceRate: 92.5, totalStudents: 150 },
        filters: {},
        generatedBy: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          firstName: session.user.firstName || 'Admin',
          lastName: session.user.lastName || 'User',
          email: session.user.email || 'admin@example.com',
        },
      },
      {
        id: '2',
        tenantId,
        title: 'Financial Overview Q4',
        type: 'FINANCIAL',
        period: 'QUARTERLY',
        startDate: new Date(2024, 9, 1),
        endDate: new Date(2024, 11, 31),
        data: { totalRevenue: 15000, overduePayments: 3 },
        filters: {},
        generatedBy: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          firstName: session.user.firstName || 'Admin',
          lastName: session.user.lastName || 'User',
          email: session.user.email || 'admin@example.com',
        },
      },
    ];

    // Filter by type and period if specified
    let filteredReports = mockReports;
    if (type) {
      filteredReports = filteredReports.filter(report => report.type === type);
    }
    if (period) {
      filteredReports = filteredReports.filter(report => report.period === period);
    }

    // Apply pagination
    const paginatedReports = filteredReports.slice(offset, offset + limit);

    return NextResponse.json({
      reports: paginatedReports,
      totalCount: filteredReports.length,
      hasMore: offset + paginatedReports.length < filteredReports.length,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, type, period, startDate, endDate, filters, data } = body;

    if (!title || !type || !period || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get tenant ID (in production, get from session or middleware)
    const tenantId = '1'; // For demo purposes

    // For now, return mock created report
    const mockReport = {
      id: Date.now().toString(),
      tenantId,
      title,
      type,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      data: data || {},
      filters: filters || {},
      generatedBy: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        firstName: session.user.firstName || 'Admin',
        lastName: session.user.lastName || 'User',
        email: session.user.email || 'admin@example.com',
      },
    };

    return NextResponse.json(mockReport, { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
