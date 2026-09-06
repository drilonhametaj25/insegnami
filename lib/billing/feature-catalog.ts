/**
 * Catalogo statico delle feature di piano: chiavi, etichette e piano minimo.
 * Modulo PURO (nessun import server-side): importabile anche dai client
 * component (Sidebar, pricing, UpsellModal). La logica runtime di risoluzione
 * (hasFeature/getEffectiveFeatures) resta in lib/billing/features.ts, che
 * ri-esporta queste definizioni.
 */

export type FeatureKey =
  | 'paymentReminders'
  | 'einvoicing'
  | 'payroll'
  | 'accounting'
  | 'hoursPackages'
  | 'analytics'
  | 'scheduleGenerator'
  | 'bulkImport'
  | 'absenceJustifications'
  | 'automationsConfig'
  | 'whiteLabel'
  | 'auditTrail';

export const ALL_FEATURE_KEYS: FeatureKey[] = [
  'paymentReminders',
  'einvoicing',
  'payroll',
  'accounting',
  'hoursPackages',
  'analytics',
  'scheduleGenerator',
  'bulkImport',
  'absenceJustifications',
  'automationsConfig',
  'whiteLabel',
  'auditTrail',
];

/** Etichette condivise da pricing pubblico, billing page e modali di upsell. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  paymentReminders: 'Solleciti di pagamento automatici',
  einvoicing: 'Fatturazione elettronica (export XML SDI)',
  payroll: 'Cedolini e compensi docenti',
  accounting: 'Contabilità e conto economico',
  hoursPackages: 'Pacchetti ore prepagati',
  analytics: 'Analytics e report avanzati',
  scheduleGenerator: 'Generatore automatico orari',
  bulkImport: 'Import studenti e docenti da CSV/Excel',
  absenceJustifications: 'Giustificazione assenze online',
  automationsConfig: 'Automazioni personalizzabili',
  whiteLabel: 'Logo scuola su PDF ed email',
  auditTrail: 'Audit trail esteso ed export DPO',
};

/** Piano minimo che include la feature (per i badge di upsell in UI). */
export const FEATURE_MIN_PLAN: Record<FeatureKey, 'starter' | 'professional' | 'enterprise'> = {
  paymentReminders: 'starter',
  einvoicing: 'professional',
  payroll: 'professional',
  accounting: 'professional',
  hoursPackages: 'professional',
  analytics: 'professional',
  scheduleGenerator: 'professional',
  bulkImport: 'professional',
  absenceJustifications: 'professional',
  automationsConfig: 'enterprise',
  whiteLabel: 'enterprise',
  auditTrail: 'enterprise',
};

/** Etichetta badge di upsell per la feature (PRO / ENTERPRISE). */
export function featureBadgeLabel(key: FeatureKey): string {
  return FEATURE_MIN_PLAN[key] === 'enterprise' ? 'ENTERPRISE' : 'PRO';
}
