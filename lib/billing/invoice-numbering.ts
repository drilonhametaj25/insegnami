import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Assigns the next sequential invoice number for a given series + year,
 * atomically. Italian law requires NO gaps in the sequence — once a number
 * is assigned to an Invoice that becomes ISSUED, that number is consumed
 * forever. Concurrent requests must serialize, otherwise two invoices can
 * race and end up with the same number (unique-violation in the DB)
 * or with a gap (sanctionable).
 *
 * Strategy:
 *   1. Open a Postgres transactional advisory lock keyed on the series id.
 *      Two concurrent calls for the SAME series block on the second one
 *      until the first commits/rolls back. Different series do not block
 *      each other.
 *   2. Read InvoiceSeries.yearCounters (Json {year: lastNumber}).
 *   3. lastNumber++ for the requested year.
 *   4. Persist the bumped counter back atomically.
 *
 * The caller is responsible for using the returned number IMMEDIATELY in
 * the same transaction (Invoice.update from DRAFT to ISSUED with the
 * assigned number). If the caller's outer transaction rolls back, the
 * counter rolls back too — no gap is created.
 *
 * Lock key: hashtext('invoice-series-' || seriesId) — Postgres advisory
 * locks take a single bigint or a pair of int4s. We use the bigint variant
 * derived from a stable hash of the series id.
 */
export async function assignInvoiceNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  params: { seriesId: string; year: number },
): Promise<number> {
  const { seriesId, year } = params;

  // Acquire the advisory lock for this series. Released automatically when
  // the surrounding transaction ends.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice-series-${seriesId}`})::bigint)`;

  // Read current counters. Json type is shaped like {"2026": 42, "2025": 117}.
  const series = await tx.invoiceSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, yearCounters: true, isActive: true },
  });

  if (!series) {
    throw new Error(`Invoice series not found: ${seriesId}`);
  }
  if (!series.isActive) {
    throw new Error(`Invoice series ${seriesId} is not active`);
  }

  const counters = (series.yearCounters as Record<string, number> | null) ?? {};
  const yearKey = String(year);
  const last = counters[yearKey] ?? 0;
  const next = last + 1;

  await tx.invoiceSeries.update({
    where: { id: seriesId },
    data: {
      yearCounters: { ...counters, [yearKey]: next },
    },
  });

  return next;
}

/**
 * Format a number for display: "F/2026/0001" (prefix + year + 4-digit zero-padded).
 * Pure formatting helper — accepts the prefix from InvoiceSeries.prefix.
 * Italian convention pads to at least 4 digits and uses "/" as separator.
 */
export function formatInvoiceNumber(prefix: string | null, year: number, number: number): string {
  const padded = String(number).padStart(4, '0');
  if (prefix && prefix.trim()) {
    return `${prefix}/${year}/${padded}`;
  }
  return `${year}/${padded}`;
}
