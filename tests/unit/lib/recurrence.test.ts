/**
 * lib/lessons/recurrence — formato canonico RRULE: build, parse e
 * generazione occorrenze con UNTIL e COUNT (cap MAX_OCCURRENCES).
 */

import {
  buildRRuleString,
  normalizeRRuleString,
  generateOccurrences,
  parseRecurrenceRule,
  isRRuleString,
  MAX_OCCURRENCES,
} from '@/lib/lessons/recurrence';

// Lunedì 5 gennaio 2026, 09:00 UTC
const dtstart = new Date(Date.UTC(2026, 0, 5, 9, 0, 0));

describe('buildRRuleString', () => {
  it('genera una RRULE settimanale canonica con COUNT', () => {
    const rule = buildRRuleString(
      { frequency: 'weekly', interval: 1, occurrences: 5 },
      dtstart
    );
    expect(rule).toContain('DTSTART');
    expect(rule).toContain('FREQ=WEEKLY');
    expect(rule).toContain('COUNT=5');
  });

  it('accetta le frequenze legacy maiuscole del form (WEEKLY)', () => {
    const rule = buildRRuleString(
      { frequency: 'WEEKLY', interval: 2, occurrences: 3 },
      dtstart
    );
    expect(rule).toContain('FREQ=WEEKLY');
    expect(rule).toContain('INTERVAL=2');
  });

  it('endDate (UNTIL) vince su occurrences (COUNT)', () => {
    const until = new Date(Date.UTC(2026, 0, 26, 23, 59, 59));
    const rule = buildRRuleString(
      { frequency: 'weekly', endDate: until, occurrences: 50 },
      dtstart
    );
    expect(rule).toContain('UNTIL=');
    expect(rule).not.toContain('COUNT=');
  });

  it('weekdays in convenzione getDay() → BYDAY', () => {
    const rule = buildRRuleString(
      { frequency: 'weekly', weekdays: [1, 3], occurrences: 4 },
      dtstart
    );
    expect(rule).toMatch(/BYDAY=.*MO/);
    expect(rule).toMatch(/BYDAY=.*WE/);
  });

  it('frequenza non valida → errore', () => {
    expect(() =>
      buildRRuleString({ frequency: 'yearly' as any }, dtstart)
    ).toThrow();
  });
});

describe('generateOccurrences', () => {
  it('rispetta COUNT', () => {
    const rule = buildRRuleString(
      { frequency: 'weekly', interval: 1, occurrences: 5 },
      dtstart
    );
    const dates = generateOccurrences(rule);
    expect(dates).toHaveLength(5);
    expect(dates[0].getTime()).toBe(dtstart.getTime());
    // Settimanale: +7 giorni tra le occorrenze
    expect(dates[1].getTime() - dates[0].getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it('rispetta UNTIL (endDate)', () => {
    const until = new Date(Date.UTC(2026, 0, 26, 23, 59, 59));
    const rule = buildRRuleString({ frequency: 'weekly', endDate: until }, dtstart);
    const dates = generateOccurrences(rule);
    // 5, 12, 19, 26 gennaio
    expect(dates).toHaveLength(4);
    expect(dates.every((d) => d.getTime() <= until.getTime())).toBe(true);
  });

  it('senza UNTIL/COUNT il cap è MAX_OCCURRENCES (52)', () => {
    const rule = buildRRuleString({ frequency: 'daily', interval: 1 }, dtstart);
    const dates = generateOccurrences(rule);
    expect(dates).toHaveLength(MAX_OCCURRENCES);
  });

  it('COUNT superiore al cap viene troncato a 52', () => {
    const rule = buildRRuleString(
      { frequency: 'daily', occurrences: 500 },
      dtstart
    );
    const dates = generateOccurrences(rule);
    expect(dates.length).toBeLessThanOrEqual(MAX_OCCURRENCES);
  });
});

describe('normalizeRRuleString', () => {
  it('aggiunge il DTSTART mancante e riserializza', () => {
    const rule = normalizeRRuleString('FREQ=WEEKLY;COUNT=3', dtstart);
    expect(rule).toContain('DTSTART');
    const dates = generateOccurrences(rule);
    expect(dates).toHaveLength(3);
    expect(dates[0].getTime()).toBe(dtstart.getTime());
  });
});

describe('parseRecurrenceRule', () => {
  it('round-trip su RRULE canonica (COUNT)', () => {
    const rule = buildRRuleString(
      { frequency: 'monthly', interval: 2, occurrences: 6 },
      dtstart
    );
    const parsed = parseRecurrenceRule(rule);
    expect(parsed).toMatchObject({
      frequency: 'monthly',
      interval: 2,
      occurrences: 6,
    });
  });

  it('round-trip su RRULE con UNTIL', () => {
    const until = new Date(Date.UTC(2026, 5, 30, 0, 0, 0));
    const rule = buildRRuleString({ frequency: 'weekly', endDate: until }, dtstart);
    const parsed = parseRecurrenceRule(rule);
    expect(parsed?.frequency).toBe('weekly');
    expect(parsed?.endDate).toBeTruthy();
  });

  it('weekdays tornano nella convenzione getDay()', () => {
    const rule = buildRRuleString(
      { frequency: 'weekly', weekdays: [1, 3], occurrences: 4 },
      dtstart
    );
    const parsed = parseRecurrenceRule(rule);
    expect([...(parsed?.weekdays ?? [])].sort()).toEqual([1, 3]);
  });

  it('capisce il JSON legacy dei vecchi record', () => {
    const legacy = JSON.stringify({
      frequency: 'WEEKLY',
      interval: 1,
      endDate: '2026-06-30T00:00:00.000Z',
    });
    const parsed = parseRecurrenceRule(legacy);
    expect(parsed?.frequency).toBe('weekly');
    expect(parsed?.endDate).toBe('2026-06-30T00:00:00.000Z');
  });

  it('input non interpretabile → null', () => {
    expect(parseRecurrenceRule('garbage')).toBeNull();
    expect(parseRecurrenceRule(null)).toBeNull();
    expect(parseRecurrenceRule('{broken json')).toBeNull();
  });
});

describe('isRRuleString', () => {
  it('riconosce le stringhe RRULE e scarta il JSON legacy', () => {
    expect(isRRuleString('DTSTART:20260105T090000Z\nRRULE:FREQ=WEEKLY')).toBe(true);
    expect(isRRuleString('FREQ=WEEKLY;COUNT=3')).toBe(true);
    expect(isRRuleString(JSON.stringify({ frequency: 'weekly' }))).toBe(false);
    expect(isRRuleString(undefined)).toBe(false);
  });
});
