import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    
    // Get recent activities from various models
    const activities = [];

    // Recent student enrollments
    const recentStudents = await prisma.student.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      }
    });

    activities.push(...recentStudents.map(student => ({
      id: `student_${student.id}`,
      type: 'enrollment',
      description: `${student.firstName} ${student.lastName} enrolled as new student`,
      timestamp: student.createdAt,
      icon: '🎓'
    })));

    // Recent payments
    const recentPayments = await prisma.payment.findMany({
      where: { 
        tenantId,
        status: 'PAID'
      },
      orderBy: { paidDate: 'desc' },
      take: 3,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    activities.push(...recentPayments.map(payment => ({
      id: `payment_${payment.id}`,
      type: 'payment',
      description: `Payment received from ${payment.student.firstName} ${payment.student.lastName} - €${payment.amount}`,
      timestamp: payment.paidDate || payment.updatedAt,
      icon: '💰'
    })));

    // Recent notices
    const recentNotices = await prisma.notice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: {
        id: true,
        title: true,
        createdAt: true,
      }
    });

    activities.push(...recentNotices.map(notice => ({
      id: `notice_${notice.id}`,
      type: 'notice',
      description: `New notice published: ${notice.title}`,
      timestamp: notice.createdAt,
      icon: '📢'
    })));

    // Sort all activities by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Error fetching admin activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
