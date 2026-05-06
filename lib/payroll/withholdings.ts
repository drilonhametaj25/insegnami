import type { PayrollWithholdingType } from '@prisma/client';

/**
 * Withholdings applier — pure arithmetic, no fiscal calculation logic.
 *
 * The school configures default withholdings per teacher in
 * TeacherPayrollSettings.defaultWithholdings (Json array). Typical entries
 * for an Italian P.IVA teacher:
 *   [{ type: 'RITENUTA_ACCONTO', rate: 20, label: "Ritenuta d'acconto 20%" }]
 *
 * This module does NOT compute IRPEF brackets, INPS contributions,
 * regional/communal taxes, or anything else that requires a real payroll
 * software. The UI carries an explicit disclaimer ("Strumento di costing,
 * non sostitutivo di consulente del lavoro / busta paga ufficiale").
 *
 * Output shape mirrors PayrollWithholding rows so the generator can write
 * directly without remapping.
 */

export type WithholdingConfig = {
  type: PayrollWithholdingType;
  rate: number;   // percentage, e.g. 20 = 20%
  label: string;
  /** When true, this withholding's `amount` reduces the base for SUBSEQUENT entries (cascade). Default false (parallel). */
  reducesBase?: boolean;
};

export type AppliedWithholding = {
  type: PayrollWithholdingType;
  label: string;
  rate: number;
  base: number;
  amount: number;
};

export type WithholdingsResult = {
  applied: AppliedWithholding[];
  total: number;
};

/**
 * Apply an array of withholding configs to a gross base.
 *
 * Default mode: each withholding is computed against the original
 * grossBase (parallel). Set `reducesBase: true` on a config to make
 * subsequent withholdings see the post-deduction base — needed when
 * a tenant configures cascading taxes.
 */
export function applyWithholdings(
  grossBase: number,
  configs: WithholdingConfig[] | null | undefined,
): WithholdingsResult {
  if (!configs || configs.length === 0) {
    return { applied: [], total: 0 };
  }

  const applied: AppliedWithholding[] = [];
  let runningBase = grossBase;
  let total = 0;

  for (const c of configs) {
    const base = c.reducesBase ? runningBase : grossBase;
    const amount = round2((base * c.rate) / 100);
    applied.push({
      type: c.type,
      label: c.label,
      rate: c.rate,
      base: round2(base),
      amount,
    });
    total += amount;
    if (c.reducesBase) runningBase = round2(runningBase - amount);
  }

  return { applied, total: round2(total) };
}

/**
 * Coerce raw Json from TeacherPayrollSettings.defaultWithholdings into the
 * typed config array. Tolerates unknown extra fields and casts numeric
 * strings into numbers — defensive because the field is `Json` and could
 * have been hand-edited.
 */
export function parseWithholdingsFromSettings(raw: unknown): WithholdingConfig[] {
  if (!Array.isArray(raw)) return [];
  const allowedTypes: PayrollWithholdingType[] = ['RITENUTA_ACCONTO', 'INPS', 'INAIL', 'OTHER'];
  const out: WithholdingConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const type = String(obj.type ?? 'OTHER') as PayrollWithholdingType;
    if (!allowedTypes.includes(type)) continue;
    const rate = Number(obj.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) continue;
    const label = String(obj.label ?? type);
    const reducesBase = Boolean(obj.reducesBase);
    out.push({ type, rate, label, reducesBase });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
