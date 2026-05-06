import { prisma } from '@/lib/db';

export type HolidayMatch = { date: Date; name: string; recurring: boolean };

/**
 * Italian national holidays + Catholic religious feasts that schools always
 * observe. Excludes Easter (variable date — handled separately if needed).
 *
 * Used by `seedItalianHolidays()` to bootstrap a tenant's calendar.
 */
export const ITALIAN_FIXED_HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  { month: 1,  day: 1,  name: 'Capodanno' },
  { month: 1,  day: 6,  name: 'Epifania' },
  { month: 4,  day: 25, name: 'Festa della Liberazione' },
  { month: 5,  day: 1,  name: 'Festa dei Lavoratori' },
  { month: 6,  day: 2,  name: 'Festa della Repubblica' },
  { month: 8,  day: 15, name: 'Ferragosto' },
  { month: 11, day: 1,  name: 'Tutti i Santi' },
  { month: 12, day: 8,  name: 'Immacolata Concezione' },
  { month: 12, day: 25, name: 'Natale' },
  { month: 12, day: 26, name: 'Santo Stefano' },
];

/**
 * Seed national fixed holidays for a tenant. Idempotent — re-running
 * adds only the missing ones thanks to the unique constraint
 * [tenantId, date, name].
 *
 * Stores using the year of `referenceDate` (or current year). Because
 * `recurring: true`, the holiday matcher ignores the year component
 * — so seeding once is enough across school years.
 */
export async function seedItalianHolidays(tenantId: string, referenceYear?: number): Promise<number> {
  const year = referenceYear ?? new Date().getFullYear();
  const rows = ITALIAN_FIXED_HOLIDAYS.map((h) => ({
    tenantId,
    date: new Date(Date.UTC(year, h.month - 1, h.day)),
    name: h.name,
    recurring: true,
  }));

  let inserted = 0;
  for (const row of rows) {
    try {
      await prisma.holiday.create({ data: row });
      inserted += 1;
    } catch (err: any) {
      // Unique constraint violation = already seeded → skip silently.
      if (err?.code !== 'P2002') throw err;
    }
  }
  return inserted;
}

/**
 * Build a Set of holiday "fingerprints" for a given date range and tenant.
 * Each fingerprint is `YYYY-MM-DD` (or `MM-DD` for recurring entries).
 *
 * Looking up a candidate date is O(1):
 *   if (set.has(toFingerprint(d, false)) || set.has(toFingerprint(d, true))) skip
 *
 * The matcher is range-bounded to avoid loading every Holiday row for a
 * tenant that has decades of historical data.
 */
export async function loadHolidayFingerprints(
  tenantId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ has: (d: Date) => boolean; count: number }> {
  const holidays = await prisma.holiday.findMany({
    where: {
      tenantId,
      OR: [
        { recurring: true },
        { date: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
    select: { date: true, recurring: true },
  });

  const exact = new Set<string>();
  const recurring = new Set<string>();
  for (const h of holidays) {
    const d = h.date;
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    if (h.recurring) {
      recurring.add(`${mm}-${dd}`);
    } else {
      const yyyy = d.getUTCFullYear();
      exact.add(`${yyyy}-${mm}-${dd}`);
    }
  }

  return {
    count: holidays.length,
    has: (d: Date) => {
      // Compare using LOCAL date components — the candidate is a real
      // calendar day in Europe/Rome, not a UTC instant.
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return exact.has(`${yyyy}-${mm}-${dd}`) || recurring.has(`${mm}-${dd}`);
    },
  };
}
