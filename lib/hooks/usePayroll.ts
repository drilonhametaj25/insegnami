import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { GenerateResult } from '@/lib/payroll/payroll-generator';
import { accountingKeys } from './useAccounting';

/**
 * Hook React Query per il payroll docenti (C1.2).
 *
 * Le shape delle risposte rispecchiano fedelmente le API:
 * - GET  /api/payroll/periods                  → { periods } (con _count.payrolls)
 * - POST /api/payroll/periods                  → { period }
 * - POST /api/payroll/periods/[id]/generate    → GenerateResult
 * - POST /api/payroll/periods/[id]/lock        → { period }
 * - GET  /api/payroll/[id]                     → { payroll } (con lineItems/withholdings)
 * - PATCH /api/payroll/[id]                    → { payroll }
 * - DELETE /api/payroll/[id]                   → { success }
 * - POST /api/payroll/[id]/approve             → { payroll }
 * - POST /api/payroll/[id]/mark-paid           → { payroll, movementId }
 * - GET/PUT /api/teachers/[id]/payroll-settings → { settings }
 *
 * PDF cedolino: nessun hook — link diretto a /api/payroll/[id]/payslip-pdf.
 */

// ---------------------------------------------------------------------------
// Tipi (i Decimal Prisma sono serializzati come stringhe da NextResponse.json)
// ---------------------------------------------------------------------------

export type PayrollPeriodStatus = 'OPEN' | 'LOCKED' | 'PAID';
export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID';
export type PayrollLineItemType = 'HOURS' | 'BONUS' | 'EXPENSE_REIMBURSEMENT' | 'ADJUSTMENT' | 'OTHER';
export type WithholdingType = 'RITENUTA_ACCONTO' | 'INPS' | 'INAIL' | 'OTHER';

export interface PayrollPeriod {
  id: string;
  tenantId: string;
  year: number;
  month: number;
  status: PayrollPeriodStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { payrolls: number };
}

export interface PayrollLineItem {
  id: string;
  payrollId: string;
  type: PayrollLineItemType;
  description: string;
  quantity?: string | number | null;
  unitAmount: string | number;
  total: string | number;
  lessonId?: string | null;
}

export interface PayrollWithholding {
  id: string;
  payrollId: string;
  type: WithholdingType;
  label: string;
  rate: string | number;
  base: string | number;
  amount: string | number;
}

export interface Payroll {
  id: string;
  tenantId: string;
  teacherId: string;
  periodId: string;
  status: PayrollStatus;
  grossAmount: string | number;
  withholdingAmount: string | number;
  netAmount: string | number;
  hourlyRateSnapshot?: string | number | null;
  notes?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  createdAt: string;
  updatedAt: string;
  // Include del dettaglio
  teacher?: { id: string; firstName: string; lastName: string; email: string; teacherCode?: string | null };
  period?: PayrollPeriod;
  lineItems?: PayrollLineItem[];
  withholdings?: PayrollWithholding[];
}

export interface PayrollPeriodFilters {
  year?: number;
  status?: string;
}

export interface CreatePayrollPeriodData {
  year: number;
  month: number;
  notes?: string;
}

export interface UpdatePayrollData {
  notes?: string | null;
  /** Sostituisce TUTTI gli extra (line item non-HOURS); le righe HOURS sono gestite dal generatore */
  extras?: Array<{
    type: PayrollLineItemType;
    description: string;
    quantity?: number;
    unitAmount: number;
    total: number;
    lessonId?: string;
  }>;
  withholdings?: Array<{
    type: WithholdingType;
    label: string;
    rate: number;
    base: number;
    amount: number;
  }>;
}

export interface MarkPayrollPaidData {
  paidAt?: string;
  paymentReference?: string;
}

export interface WithholdingConfig {
  type: WithholdingType;
  rate: number;
  label: string;
  reducesBase?: boolean;
}

export interface TeacherPayrollSettings {
  teacherId: string;
  taxRegime: 'FORFETTARIO' | 'ORDINARIO' | 'DIPENDENTE' | 'COCOCO' | 'OTHER';
  iban?: string | null;
  defaultWithholdings: WithholdingConfig[];
  notes?: string | null;
}

export interface SaveTeacherPayrollSettingsData {
  taxRegime?: TeacherPayrollSettings['taxRegime'];
  iban?: string | null;
  defaultWithholdings?: WithholdingConfig[];
  notes?: string | null;
}

export type { GenerateResult };

// ---------------------------------------------------------------------------
// Query keys factory
// ---------------------------------------------------------------------------

export const payrollKeys = {
  all: ['payroll'] as const,
  periods: () => [...payrollKeys.all, 'periods'] as const,
  periodList: (filters: Record<string, unknown>) => [...payrollKeys.periods(), filters] as const,
  details: () => [...payrollKeys.all, 'detail'] as const,
  detail: (id: string) => [...payrollKeys.details(), id] as const,
  teacherSettings: (teacherId: string) => [...payrollKeys.all, 'teacher-settings', teacherId] as const,
};

// ---------------------------------------------------------------------------
// Helper interni
// ---------------------------------------------------------------------------

/** Costruisce la querystring scartando valori vuoti/undefined/null */
function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, String(value));
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Gestione uniforme degli errori delle mutation: usa il messaggio del server */
async function throwApiError(response: Response, fallback: string): Promise<never> {
  const error = await response.json().catch(() => ({}));
  throw new Error(error.error || fallback);
}

// ---------------------------------------------------------------------------
// Hook periodi
// ---------------------------------------------------------------------------

/**
 * Lista periodi paghe con filtri year/status (include _count.payrolls)
 */
export function usePayrollPeriods(filters: PayrollPeriodFilters = {}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: payrollKeys.periodList({ ...filters }),
    queryFn: async (): Promise<{ periods: PayrollPeriod[] }> => {
      const qs = buildQuery({ ...filters });
      const response = await fetch(`/api/payroll/periods${qs}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch payroll periods: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Crea (o riapre idempotentemente) un periodo {year, month}
 */
export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePayrollPeriodData): Promise<{ period: PayrollPeriod }> => {
      const response = await fetch('/api/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to create payroll period');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
    },
  });
}

/**
 * Genera i cedolini DRAFT per tutti i docenti attivi del periodo
 */
export function useGeneratePayrolls() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string): Promise<GenerateResult> => {
      const response = await fetch(`/api/payroll/periods/${periodId}/generate`, {
        method: 'POST',
      });
      if (!response.ok) await throwApiError(response, 'Failed to generate payrolls');
      return response.json();
    },
    onSuccess: () => {
      // La lista periodi mostra _count.payrolls; i dettagli possono essere nuovi
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
      queryClient.invalidateQueries({ queryKey: payrollKeys.details() });
    },
  });
}

/**
 * Blocca un periodo (OPEN → LOCKED): i cedolini diventano read-only
 */
export function useLockPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string): Promise<{ period: PayrollPeriod }> => {
      const response = await fetch(`/api/payroll/periods/${periodId}/lock`, {
        method: 'POST',
      });
      if (!response.ok) await throwApiError(response, 'Failed to lock payroll period');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook cedolini
// ---------------------------------------------------------------------------

/**
 * Dettaglio cedolino (con lineItems, withholdings, teacher e period)
 */
export function usePayroll(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: payrollKeys.detail(id),
    queryFn: async (): Promise<{ payroll: Payroll }> => {
      const response = await fetch(`/api/payroll/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch payroll: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Aggiorna un cedolino DRAFT (note, extras, withholdings — PATCH)
 */
export function useUpdatePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePayrollData }): Promise<{ payroll: Payroll }> => {
      const response = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to update payroll');
      return response.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
    },
  });
}

/**
 * Approva un cedolino (DRAFT → APPROVED)
 */
export function useApprovePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ payroll: Payroll }> => {
      const response = await fetch(`/api/payroll/${id}/approve`, { method: 'POST' });
      if (!response.ok) await throwApiError(response, 'Failed to approve payroll');
      return response.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
    },
  });
}

/**
 * Segna un cedolino come pagato (APPROVED → PAID).
 * Lato server crea anche l'AccountingMovement COST: invalidiamo pure
 * le query contabili così il P&L resta coerente.
 */
export function useMarkPayrollPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data = {} }: { id: string; data?: MarkPayrollPaidData }): Promise<{ payroll: Payroll; movementId: string | null }> => {
      const response = await fetch(`/api/payroll/${id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to mark payroll as paid');
      return response.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
      // Il mark-paid genera un movimento contabile COST
      queryClient.invalidateQueries({ queryKey: accountingKeys.all });
    },
  });
}

/**
 * Elimina un cedolino DRAFT (per rigenerarlo)
 */
export function useDeletePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/payroll/${id}`, { method: 'DELETE' });
      if (!response.ok) await throwApiError(response, 'Failed to delete payroll');
      return response.json();
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: payrollKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook impostazioni payroll docente
// ---------------------------------------------------------------------------

/**
 * Impostazioni payroll di un docente (regime fiscale, IBAN, ritenute default)
 */
export function useTeacherPayrollSettings(teacherId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: payrollKeys.teacherSettings(teacherId),
    queryFn: async (): Promise<{ settings: TeacherPayrollSettings | null }> => {
      const response = await fetch(`/api/teachers/${teacherId}/payroll-settings`);
      if (!response.ok) {
        throw new Error(`Failed to fetch teacher payroll settings: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user && !!teacherId,
  });
}

/**
 * Upsert impostazioni payroll docente (PUT)
 */
export function useSaveTeacherPayrollSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teacherId, data }: { teacherId: string; data: SaveTeacherPayrollSettingsData }): Promise<{ settings: TeacherPayrollSettings }> => {
      const response = await fetch(`/api/teachers/${teacherId}/payroll-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to save teacher payroll settings');
      return response.json();
    },
    onSuccess: (_data, { teacherId }) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.teacherSettings(teacherId) });
    },
  });
}
