/**
 * Ricorrenze lezioni — formato canonico: stringa RRULE (RFC 5545) salvata su
 * Lesson.recurrenceRule (con DTSTART incluso). La generazione delle occorrenze
 * è EAGER alla creazione della serie: il worker BullMQ "recurring" è deprecato.
 *
 * Compat legacy: i vecchi record hanno un JSON {frequency, interval, endDate,
 * occurrences, weekdays}; parseRecurrenceRule li accetta ancora.
 */

import { RRule, rrulestr, Weekday } from 'rrule';

export const MAX_OCCURRENCES = 52;

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export type RecurrenceInput = {
  frequency: RecurrenceFrequency | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** Ogni X giorni/settimane/mesi (default 1) */
  interval?: number;
  /** Fine ricorrenza (UNTIL) — prioritaria su occurrences */
  endDate?: string | Date | null;
  /** Numero massimo di occorrenze (COUNT), cap a MAX_OCCURRENCES */
  occurrences?: number | null;
  /** Giorni della settimana in convenzione Date.getDay(): 0=domenica ... 6=sabato */
  weekdays?: number[] | null;
};

const FREQ_MAP: Record<RecurrenceFrequency, number> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
};

// Indice = Date.getDay() (0=domenica)
const WEEKDAY_MAP: Weekday[] = [
  RRule.SU,
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
];

export function isRRuleString(value: unknown): value is string {
  return typeof value === 'string' && /FREQ=/i.test(value) && !value.trim().startsWith('{');
}

/**
 * Costruisce la stringa RRULE canonica (DTSTART incluso) a partire dai campi
 * del form. Se sono presenti sia endDate che occurrences vince endDate (UNTIL).
 */
export function buildRRuleString(input: RecurrenceInput, dtstart: Date): string {
  const frequency = String(input.frequency).toLowerCase() as RecurrenceFrequency;
  const freq = FREQ_MAP[frequency];
  if (freq === undefined) {
    throw new Error(`Frequenza ricorrenza non valida: ${input.frequency}`);
  }

  const interval = Math.max(1, Math.trunc(input.interval ?? 1));
  const until = input.endDate ? new Date(input.endDate) : undefined;
  const count =
    !until && input.occurrences
      ? Math.min(Math.max(1, Math.trunc(input.occurrences)), MAX_OCCURRENCES)
      : undefined;

  const byweekday =
    frequency === 'weekly' && input.weekdays && input.weekdays.length > 0
      ? input.weekdays
          .filter((d) => d >= 0 && d <= 6)
          .map((d) => WEEKDAY_MAP[d])
      : undefined;

  const rule = new RRule({
    freq,
    interval,
    dtstart,
    ...(until ? { until } : {}),
    ...(count ? { count } : {}),
    ...(byweekday && byweekday.length > 0 ? { byweekday } : {}),
  });

  return rule.toString();
}

/**
 * Normalizza una stringa RRULE arbitraria nel formato canonico: se manca il
 * DTSTART lo aggiunge dal parametro, poi riserializza.
 */
export function normalizeRRuleString(rruleString: string, dtstart: Date): string {
  const hasDtstart = /DTSTART/i.test(rruleString);
  const rule = rrulestr(rruleString, hasDtstart ? undefined : { dtstart });
  return rule.toString();
}

/**
 * Genera le date delle occorrenze da una stringa RRULE canonica.
 * Rispetta UNTIL/COUNT e comunque non supera `max` (default MAX_OCCURRENCES).
 */
export function generateOccurrences(
  rruleString: string,
  opts: { dtstart?: Date; max?: number } = {}
): Date[] {
  const max = Math.min(opts.max ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const hasDtstart = /DTSTART/i.test(rruleString);
  const rule = rrulestr(
    rruleString,
    hasDtstart ? undefined : { dtstart: opts.dtstart }
  );
  // L'iteratore ferma la generazione alla max-esima occorrenza
  return rule.all((_date, i) => i < max);
}

/**
 * Riporta una recurrenceRule salvata (RRULE canonica o JSON legacy) alla
 * forma "input" usata dai form. Ritorna null se non interpretabile.
 */
export function parseRecurrenceRule(stored: string | null | undefined): RecurrenceInput | null {
  if (!stored) return null;

  // Legacy: JSON {frequency, interval, endDate, occurrences, weekdays}
  if (stored.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && parsed.frequency) {
        return {
          frequency: String(parsed.frequency).toLowerCase() as RecurrenceFrequency,
          interval: parsed.interval ?? 1,
          endDate: parsed.endDate ?? null,
          occurrences: parsed.occurrences ?? null,
          weekdays: Array.isArray(parsed.weekdays) ? parsed.weekdays : null,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  if (!isRRuleString(stored)) return null;

  try {
    const rule = rrulestr(stored);
    const o = rule.origOptions;
    const frequency: RecurrenceFrequency =
      o.freq === RRule.DAILY ? 'daily' : o.freq === RRule.MONTHLY ? 'monthly' : 'weekly';
    const byweekday = o.byweekday
      ? (Array.isArray(o.byweekday) ? o.byweekday : [o.byweekday])
          .map((w) => {
            // Weekday rrule: 0=lunedì ... 6=domenica → convenzione getDay()
            const wd = typeof w === 'number' ? w : (w as Weekday).weekday;
            return (wd + 1) % 7;
          })
      : null;
    return {
      frequency,
      interval: o.interval ?? 1,
      endDate: o.until ?? null,
      occurrences: o.count ?? null,
      weekdays: byweekday,
    };
  } catch {
    return null;
  }
}
