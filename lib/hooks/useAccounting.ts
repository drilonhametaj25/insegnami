import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { PnLReport, PnLLine } from '@/lib/accounting/pnl';

/**
 * Hook React Query per la contabilità (C1.3).
 *
 * Le shape delle risposte rispecchiano fedelmente le API:
 * - GET  /api/accounting/movements → { movements, pagination }
 * - POST /api/accounting/movements → { movement } (source forzato a MANUAL)
 * - GET  /api/accounting/pnl       → { report: PnLReport, trend: PnLTrendPoint[] | null }
 *
 * I tipi PnLReport/PnLLine sono riusati dal servizio server lib/accounting/pnl
 * (import type: nessun codice server viene incluso nel bundle client).
 */

// ---------------------------------------------------------------------------
// Tipi (i Decimal Prisma sono serializzati come stringhe da NextResponse.json)
// ---------------------------------------------------------------------------

export type MovementType = 'REVENUE' | 'COST';
export type MovementSource = 'PAYMENT' | 'PAYROLL' | 'MANUAL';

export interface AccountingMovement {
  id: string;
  tenantId: string;
  date: string;
  type: MovementType;
  source: MovementSource;
  category: string;
  amount: string | number;
  currency: string;
  description?: string | null;
  classId?: string | null;
  courseId?: string | null;
  studentId?: string | null;
  paymentId?: string | null;
  payrollId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface AccountingMovementsResponse {
  movements: AccountingMovement[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface MovementFilters {
  type?: string;
  source?: string;
  category?: string;
  from?: string;
  to?: string;
}

export interface CreateMovementData {
  /** Data del movimento (ISO o YYYY-MM-DD) */
  date: string;
  type: MovementType;
  category: string;
  amount: number;
  currency?: string;
  description?: string;
  classId?: string;
  courseId?: string;
  studentId?: string;
}

/** Punto della serie mensile ritornata da getPnLTrend */
export interface PnLTrendPoint {
  year: number;
  month: number;
  revenue: number;
  cost: number;
  margin: number;
}

export interface PnLParams {
  /** Data inizio periodo (YYYY-MM-DD); default lato server: inizio mese corrente */
  from?: string;
  /** Data fine periodo (YYYY-MM-DD); default lato server: fine mese corrente */
  to?: string;
  /** Numero di mesi del trend (1..24); se assente il server non calcola il trend */
  trend?: number;
}

export interface PnLResponse {
  report: PnLReport;
  trend: PnLTrendPoint[] | null;
}

// Riesporta i tipi del servizio P&L per i consumer client
export type { PnLReport, PnLLine };

// ---------------------------------------------------------------------------
// Query keys factory
// ---------------------------------------------------------------------------

export const accountingKeys = {
  all: ['accounting'] as const,
  movements: () => [...accountingKeys.all, 'movements'] as const,
  movementList: (filters: Record<string, unknown>) =>
    [...accountingKeys.movements(), filters] as const,
  pnls: () => [...accountingKeys.all, 'pnl'] as const,
  pnl: (params: Record<string, unknown>) => [...accountingKeys.pnls(), params] as const,
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
// Hook
// ---------------------------------------------------------------------------

/**
 * Lista movimenti contabili con filtri (type/source/category/from/to) e paginazione
 */
export function useAccountingMovements(page = 1, pageSize = 50, filters: MovementFilters = {}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: accountingKeys.movementList({ page, pageSize, ...filters }),
    queryFn: async (): Promise<AccountingMovementsResponse> => {
      const qs = buildQuery({ page, pageSize, ...filters });
      const response = await fetch(`/api/accounting/movements${qs}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch accounting movements: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Crea un movimento manuale (source=MANUAL lato server).
 * Invalida sia i movimenti sia il P&L, che è derivato dai movimenti.
 */
export function useCreateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMovementData): Promise<{ movement: AccountingMovement }> => {
      const response = await fetch('/api/accounting/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to create accounting movement');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.movements() });
      queryClient.invalidateQueries({ queryKey: accountingKeys.pnls() });
    },
  });
}

/**
 * Report P&L per il periodo richiesto, con trend mensile opzionale
 */
export function usePnL(params: PnLParams = {}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: accountingKeys.pnl({ ...params }),
    queryFn: async (): Promise<PnLResponse> => {
      const qs = buildQuery({ ...params });
      const response = await fetch(`/api/accounting/pnl${qs}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch P&L: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minuti: è un report aggregato
  });
}
