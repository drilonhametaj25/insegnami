import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope, getTeacherIdForUser } from '@/lib/api-auth';
import { buildPayslipPdf } from '@/lib/payroll/pdf/payslip-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/payroll/[id]/payslip-pdf — stream the cedolino PDF inline.
 *
 * Access: ADMIN/DIRECTOR/SECRETARY can read any payroll in tenant scope;
 * TEACHER can read only their own (the lib auth helper resolves the
 * Teacher.id from the session and we filter on that).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'payroll' }, feature: 'payroll' });
    const { id } = await params;

    const where: any = tenantScope(ctx, { id });
    if (ctx.role === 'TEACHER') {
      const tid = await getTeacherIdForUser(ctx);
      where.teacherId = tid ?? '__no_teacher__';
    }

    const payroll = await prisma.payroll.findFirst({
      where,
      include: {
        teacher: { select: { firstName: true, lastName: true, teacherCode: true, email: true } },
        period: { select: { year: true, month: true } },
        lineItems: { orderBy: { id: 'asc' } },
        withholdings: { orderBy: { id: 'asc' } },
        tenant: { select: { name: true } },
      },
    });
    if (!payroll) return NextResponse.json({ error: 'Cedolino non trovato' }, { status: 404 });

    const settings = await prisma.invoiceSettings.findUnique({
      where: { tenantId: payroll.tenantId },
      select: { denominazione: true, partitaIva: true, indirizzo: true, cap: true, comune: true },
    });

    const buffer = buildPayslipPdf({
      payroll,
      lineItems: payroll.lineItems,
      withholdings: payroll.withholdings,
      teacher: payroll.teacher,
      period: payroll.period,
      settings: settings as any,
      tenantName: payroll.tenant.name,
    });

    const filename = `cedolino-${payroll.period.year}-${String(payroll.period.month).padStart(2, '0')}-${payroll.teacher.teacherCode}.pdf`;
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('payslip-pdf error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
