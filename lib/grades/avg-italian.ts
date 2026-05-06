import type { GradeType } from '@prisma/client';

export type GradeInput = {
  type: GradeType;
  value: number;
  weight: number;
};

export type SubjectAverages = {
  averageOral: number | null;
  averageWritten: number | null;
  averagePractical: number | null;
  overallAverage: number | null;
  /** Voto finale proposto allo scrutinio (intero da 1 a 10 — non clamping fuori range). */
  finalProposed: number;
  isInsufficient: boolean;
  /** Numero totale di voti considerati nella media. */
  count: number;
};

export type AvgOptions = {
  /** Se true (default) i voti HOMEWORK sono esclusi dalla media finale. */
  excludeHomework?: boolean;
  /** Soglia di sufficienza (default 6). */
  passingThreshold?: number;
};

const DEFAULTS: Required<AvgOptions> = {
  excludeHomework: true,
  passingThreshold: 6,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((s, v) => s + v, 0) / values.length);
}

function weightedAvg(items: { value: number; weight: number }[]): number | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight <= 0) return null;
  const totalValue = items.reduce((s, i) => s + i.value * i.weight, 0);
  return round2(totalValue / totalWeight);
}

/**
 * Calcola le medie per una singola materia secondo la prassi italiana:
 * - Media aritmetica per tipologia (orale / scritto / pratico) — non pesata
 *   per ogni canale, perché i voti dello stesso canale hanno generalmente
 *   pari peso pedagogico nella valutazione di routine.
 * - Media complessiva pesata su `Grade.weight` (campo Prisma con default 1).
 * - I voti HOMEWORK sono esclusi di default dalla media finale (compiti per
 *   casa hanno peso formativo ma non valutativo).
 * - Voti BEHAVIOR vanno gestiti SEPARATAMENTE dal voto di condotta — non
 *   entrano nella media materia.
 *
 * `finalProposed` è il voto intero proposto al consiglio di classe:
 *   round mezzo verso l'alto se la decimale è >= 0.5, altrimenti verso il
 *   basso. Lo scrutinio può sempre derogare manualmente.
 *
 * `isInsufficient`: media (non finalProposed) < threshold (default 6).
 */
export function calcSubjectAverages(
  grades: GradeInput[],
  opts: AvgOptions = {},
): SubjectAverages {
  const o = { ...DEFAULTS, ...opts };

  const filtered = o.excludeHomework
    ? grades.filter((g) => g.type !== 'HOMEWORK' && g.type !== 'BEHAVIOR')
    : grades.filter((g) => g.type !== 'BEHAVIOR');

  const oral = filtered.filter((g) => g.type === 'ORAL').map((g) => g.value);
  const written = filtered
    .filter((g) => g.type === 'WRITTEN' || g.type === 'TEST')
    .map((g) => g.value);
  const practical = filtered.filter((g) => g.type === 'PRACTICAL').map((g) => g.value);

  const overallAverage = weightedAvg(filtered.map((g) => ({ value: g.value, weight: g.weight })));

  const finalProposed = overallAverage == null ? 0 : Math.round(overallAverage);
  const isInsufficient = overallAverage != null && overallAverage < o.passingThreshold;

  return {
    averageOral: avg(oral),
    averageWritten: avg(written),
    averagePractical: avg(practical),
    overallAverage,
    finalProposed,
    isInsufficient,
    count: filtered.length,
  };
}

/**
 * Calcola il voto di condotta come media dei voti di tipo BEHAVIOR, oppure
 * `null` se non ci sono voti di condotta numerici. Il voto di condotta è
 * tipicamente assegnato a fine periodo dal coordinatore ed è separato dalla
 * media disciplinare.
 */
export function calcBehaviorGrade(grades: GradeInput[]): number | null {
  const behavior = grades.filter((g) => g.type === 'BEHAVIOR').map((g) => g.value);
  return avg(behavior);
}

/**
 * Validità anno scolastico — DPR 122/2009: lo studente deve aver frequentato
 * almeno 3/4 del monte ore annuale (75%).
 *
 * Restituisce `true` se la frequenza è valida.
 */
export function isAttendanceValid(hoursAttended: number, hoursTotal: number, minPct = 0.75): boolean {
  if (hoursTotal <= 0) return true;
  return hoursAttended / hoursTotal >= minPct;
}
