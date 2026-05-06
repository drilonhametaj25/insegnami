import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { seedItalianHolidays } from '@/lib/scheduling/holidays';

/**
 * Bootstrap a tenant with the minimum data required to use the system.
 *
 * Without this, a freshly-registered tenant would hit "Anno scolastico non
 * trovato" / "Sezionale non trovato" / "Impostazioni fatturazione mancanti"
 * the first time the admin tries to enter grades, emit an invoice, or
 * generate a schedule.
 *
 * Idempotent: every step checks for existence first and skips when present.
 * Safe to re-run via POST /api/tenants/[id]/bootstrap to repair tenants
 * that were created before this hook existed.
 *
 * What gets created (when missing):
 *   - AcademicYear for the CURRENT scholastic year (Sept→Aug rule below)
 *     with isCurrent=true
 *   - 2 AcademicPeriods (QUADRIMESTRE: Sept-Jan and Feb-June)
 *   - Italian national holidays (10 fixed dates, recurring=true)
 *   - InvoiceSeries "VEN" with isDefault=true
 *   - InvoiceSettings with placeholder values — the admin MUST complete
 *     fiscal data before transmitting the first invoice. We create the row
 *     anyway so PUT /api/invoices/settings has something to update.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export type BootstrapReport = {
  academicYearCreated: boolean;
  academicYearId: string;
  academicPeriodsCreated: number;
  holidaysSeeded: number;
  invoiceSeriesCreated: boolean;
  invoiceSeriesId: string;
  invoiceSettingsCreated: boolean;
};

export async function bootstrapTenant(tenantId: string, options?: { tenantName?: string }): Promise<BootstrapReport> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error(`bootstrapTenant: tenant ${tenantId} not found`);

  const tenantName = options?.tenantName ?? tenant.name;

  // The "current" scholastic year: if today is between September and
  // December the year is YYYY/YYYY+1, otherwise YYYY-1/YYYY. This matches
  // Italian schools and the convention used in the rest of the app.
  const now = new Date();
  const startsThisYear = now.getMonth() >= 8; // 8 = September (0-indexed)
  const yearStart = startsThisYear ? now.getFullYear() : now.getFullYear() - 1;
  const yearEnd = yearStart + 1;
  const yearLabel = `${yearStart}/${yearEnd}`;

  return prisma.$transaction(async (tx) => {
    const academicYear = await ensureAcademicYear(tx, tenantId, yearLabel, yearStart);
    const periodsCreated = await ensureAcademicPeriods(tx, academicYear.id, yearStart);
    const holidaysSeeded = await seedItalianHolidays(tenantId, yearStart);
    const series = await ensureDefaultInvoiceSeries(tx, tenantId);
    const settings = await ensureInvoiceSettings(tx, tenantId, tenantName);

    return {
      academicYearCreated: academicYear.created,
      academicYearId: academicYear.id,
      academicPeriodsCreated: periodsCreated,
      holidaysSeeded,
      invoiceSeriesCreated: series.created,
      invoiceSeriesId: series.id,
      invoiceSettingsCreated: settings.created,
    };
  });
}

async function ensureAcademicYear(tx: Tx, tenantId: string, label: string, yearStart: number) {
  const existing = await tx.academicYear.findFirst({
    where: { tenantId, name: label },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await tx.academicYear.create({
    data: {
      tenantId,
      name: label,
      // Sept 1 → Aug 31 — Italian school year convention.
      startDate: new Date(Date.UTC(yearStart, 8, 1)),
      endDate: new Date(Date.UTC(yearStart + 1, 7, 31)),
      isCurrent: true,
    },
    select: { id: true },
  });

  // If there's any other AcademicYear for this tenant marked current,
  // demote it (only one current at a time).
  await tx.academicYear.updateMany({
    where: { tenantId, isCurrent: true, id: { not: created.id } },
    data: { isCurrent: false },
  });

  return { id: created.id, created: true };
}

async function ensureAcademicPeriods(tx: Tx, academicYearId: string, yearStart: number): Promise<number> {
  const existingCount = await tx.academicPeriod.count({ where: { academicYearId } });
  if (existingCount > 0) return 0;

  // Default: 2 quadrimestri (most common in Italian schools post-DPR 122/2009).
  await tx.academicPeriod.createMany({
    data: [
      {
        academicYearId,
        name: '1° Quadrimestre',
        type: 'QUADRIMESTRE',
        startDate: new Date(Date.UTC(yearStart, 8, 1)),     // Sept 1
        endDate: new Date(Date.UTC(yearStart + 1, 0, 31)),  // Jan 31
        orderIndex: 1,
      },
      {
        academicYearId,
        name: '2° Quadrimestre',
        type: 'QUADRIMESTRE',
        startDate: new Date(Date.UTC(yearStart + 1, 1, 1)), // Feb 1
        endDate: new Date(Date.UTC(yearStart + 1, 5, 30)),  // June 30
        orderIndex: 2,
      },
    ],
  });
  return 2;
}

async function ensureDefaultInvoiceSeries(tx: Tx, tenantId: string) {
  const existing = await tx.invoiceSeries.findFirst({
    where: { tenantId, code: 'VEN' },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await tx.invoiceSeries.create({
    data: {
      tenantId,
      code: 'VEN',
      prefix: 'F',
      description: 'Sezionale vendite (default)',
      isDefault: true,
      yearCounters: {},
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function ensureInvoiceSettings(tx: Tx, tenantId: string, tenantName: string) {
  const existing = await tx.invoiceSettings.findUnique({
    where: { tenantId },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  // PLACEHOLDERS — the admin MUST replace these before transmitting any
  // invoice (the SDI provider will reject obviously-fake fiscal data,
  // and we validate again in PUT /api/invoices/settings).
  const created = await tx.invoiceSettings.create({
    data: {
      tenantId,
      denominazione: tenantName,
      partitaIva: '00000000000',  // 11 zeros — fails Luhn, blocks accidental transmission
      codiceFiscale: '00000000000',
      regimeFiscale: 'RF01',
      indirizzo: 'Da configurare',
      cap: '00000',
      comune: 'Da configurare',
      nazione: 'IT',
      sdiProvider: 'file-system',
      conservazioneEnabled: false,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}
