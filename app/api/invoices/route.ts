import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth, authError, tenantScope } from '@/lib/api-auth';

/**
 * GET /api/invoices — paginated list, filterable.
 * POST /api/invoices — create a DRAFT invoice with lines.
 *
 * Security: tenant-scoped via tenantScope(). PARENT can read invoices that
 * are linked to their child via customerProfile.studentId; here we narrow on
 * the fly. SUPERADMIN bypasses tenant scope.
 */

const lineSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity: z.number().positive().default(1),
  unitPrice: z.number(),
  vatRate: z.number().min(0).max(100),
  vatNature: z.string().regex(/^N[1-7](\.[0-9])?$/).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  paymentId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
});

const createSchema = z.object({
  seriesId: z.string().cuid(),
  customerProfileId: z.string().cuid(),
  documentType: z.enum([
    'TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06',
    'TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD21',
    'TD22', 'TD23', 'TD24', 'TD25', 'TD26', 'TD27', 'TD28',
  ]).default('TD01'),
  issueDate: z.string().datetime().optional(),
  paymentMethod: z.string().regex(/^MP\d{2}$/).optional(),
  paymentTerms: z.array(z.object({
    dueDate: z.string().datetime().optional(),
    amount: z.number().optional(),
    iban: z.string().optional(),
  })).optional(),
  notes: z.string().max(2000).optional(),
  relatedInvoiceId: z.string().cuid().optional(),
  lines: z.array(lineSchema).min(1, 'Almeno una riga richiesta'),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'read', resource: 'invoice' } });

    const sp = request.nextUrl.searchParams;
    const page = Math.max(parseInt(sp.get('page') ?? '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(sp.get('pageSize') ?? '20', 10), 1), 100);
    const status = sp.get('status') ?? undefined;
    const sdiStatus = sp.get('sdiStatus') ?? undefined;
    const year = sp.get('year') ? parseInt(sp.get('year')!, 10) : undefined;
    const customerProfileId = sp.get('customerProfileId') ?? undefined;

    const where: any = tenantScope(ctx);
    if (status) where.status = status;
    if (sdiStatus) where.sdiStatus = sdiStatus;
    if (year) where.year = year;
    if (customerProfileId) where.customerProfileId = customerProfileId;

    // PARENT: only invoices whose customerProfile points at one of their children.
    if (ctx.role === 'PARENT') {
      where.customerProfile = {
        student: { parentUserId: ctx.userId },
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { number: 'desc' }, { createdAt: 'desc' }],
        include: {
          series: { select: { code: true, prefix: true } },
          customerProfile: { select: { id: true, denominazione: true, nome: true, cognome: true, partitaIva: true, codiceFiscale: true } },
          _count: { select: { lines: true, sdiEvents: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoices GET error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'create', resource: 'invoice' } });

    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Validate series + customer belong to the tenant.
    const [series, customer] = await Promise.all([
      prisma.invoiceSeries.findFirst({
        where: { id: data.seriesId, tenantId: ctx.tenantId, isActive: true },
        select: { id: true, prefix: true },
      }),
      prisma.invoiceCustomerProfile.findFirst({
        where: { id: data.customerProfileId, tenantId: ctx.tenantId },
        select: { id: true },
      }),
    ]);
    if (!series) return NextResponse.json({ error: 'Sezionale non trovato o disattivato' }, { status: 400 });
    if (!customer) return NextResponse.json({ error: 'Anagrafica cliente non trovata' }, { status: 400 });

    if (data.relatedInvoiceId) {
      const related = await prisma.invoice.findFirst({
        where: { id: data.relatedInvoiceId, tenantId: ctx.tenantId },
        select: { id: true, status: true },
      });
      if (!related) return NextResponse.json({ error: 'Fattura collegata non trovata' }, { status: 400 });
      if (related.status === 'DRAFT') {
        return NextResponse.json({ error: 'Non puoi collegare una nota di credito a una bozza' }, { status: 400 });
      }
    }

    const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();

    // Compute totals.
    const linesWithTotals = data.lines.map((l, idx) => {
      const discount = l.discountPercent ? l.discountPercent / 100 : 0;
      const lineSubtotal = round2(l.quantity * l.unitPrice * (1 - discount));
      return {
        lineNumber: idx + 1,
        description: l.description,
        quantity: new Prisma.Decimal(l.quantity),
        unitPrice: new Prisma.Decimal(l.unitPrice),
        vatRate: new Prisma.Decimal(l.vatRate),
        vatNature: l.vatNature,
        discountPercent: l.discountPercent ? new Prisma.Decimal(l.discountPercent) : null,
        total: new Prisma.Decimal(lineSubtotal),
        paymentId: l.paymentId,
        studentId: l.studentId,
        courseId: l.courseId,
      };
    });

    const subtotal = round2(linesWithTotals.reduce((s, l) => s + Number(l.total), 0));
    const vatTotal = round2(linesWithTotals.reduce((s, l) => s + (Number(l.total) * Number(l.vatRate)) / 100, 0));
    const total = round2(subtotal + vatTotal);

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        seriesId: data.seriesId,
        customerProfileId: data.customerProfileId,
        documentType: data.documentType,
        issueDate,
        year: issueDate.getFullYear(),
        // number stays at default 0 — assigned at issue time.
        subtotal: new Prisma.Decimal(subtotal),
        vatTotal: new Prisma.Decimal(vatTotal),
        withholdingTotal: new Prisma.Decimal(0),
        total: new Prisma.Decimal(total),
        paymentMethod: data.paymentMethod,
        paymentTerms: data.paymentTerms ?? Prisma.JsonNull,
        notes: data.notes,
        relatedInvoiceId: data.relatedInvoiceId,
        createdBy: ctx.userId,
        lines: { create: linesWithTotals },
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('invoices POST error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
