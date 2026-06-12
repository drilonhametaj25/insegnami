import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

/**
 * Hook React Query per la fatturazione elettronica (C1.1).
 *
 * Le shape delle risposte rispecchiano fedelmente le API:
 * - GET  /api/invoices                     → { invoices, pagination }
 * - POST /api/invoices                     → { invoice }
 * - GET/PATCH/DELETE /api/invoices/[id]    → { invoice } | { success }
 * - POST /api/invoices/[id]/issue          → { invoice }
 * - POST /api/invoices/[id]/transmit       → { invoice, providerId }
 * - POST /api/invoices/[id]/credit-note    → { creditNote }
 * - GET/POST /api/invoices/series          → { series }
 * - GET/PUT  /api/invoices/settings        → { settings }
 * - GET/POST /api/invoices/customer-profiles        → { profiles } | { profile }
 * - PATCH    /api/invoices/customer-profiles/[id]   → { profile }
 *
 * PDF/XML: nessun hook — si usano link diretti a /api/invoices/[id]/pdf|xml.
 */

// ---------------------------------------------------------------------------
// Tipi (interfacce locali fedeli alla risposta reale; i Decimal Prisma
// vengono serializzati come stringhe da NextResponse.json)
// ---------------------------------------------------------------------------

// Allineati agli enum Prisma InvoiceStatus / SdiTransmissionStatus
export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PAID'
  | 'CANCELLED';
export type SdiStatus =
  | 'PENDING'
  | 'TRANSMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'NOT_DELIVERED'
  | 'EXPIRED';

export interface InvoiceLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  vatRate: string | number;
  vatNature?: string | null;
  discountPercent?: string | number | null;
  total: string | number;
  paymentId?: string | null;
  studentId?: string | null;
  courseId?: string | null;
}

export interface InvoiceCustomerProfile {
  id: string;
  tenantId?: string;
  studentId?: string | null;
  userId?: string | null;
  denominazione?: string | null;
  nome?: string | null;
  cognome?: string | null;
  codiceFiscale?: string | null;
  partitaIva?: string | null;
  pec?: string | null;
  codiceDestinatario?: string;
  regimeFiscale?: string | null;
  indirizzo?: string;
  cap?: string;
  comune?: string;
  provincia?: string | null;
  nazione?: string;
  email?: string | null;
  telefono?: string | null;
  notes?: string | null;
}

export interface InvoiceSeries {
  id: string;
  code: string;
  prefix?: string | null;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  seriesId: string;
  customerProfileId: string;
  documentType: string;
  number: number;
  year: number;
  issueDate: string;
  status: InvoiceStatus;
  sdiStatus: SdiStatus;
  subtotal: string | number;
  vatTotal: string | number;
  withholdingTotal: string | number;
  total: string | number;
  paymentMethod?: string | null;
  paymentTerms?: unknown;
  notes?: string | null;
  relatedInvoiceId?: string | null;
  sdiRejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
  // Include della lista
  series?: Pick<InvoiceSeries, 'code' | 'prefix'> | InvoiceSeries;
  customerProfile?: InvoiceCustomerProfile;
  _count?: { lines: number; sdiEvents: number };
  // Include del dettaglio
  lines?: InvoiceLine[];
  sdiEvents?: Array<{
    id: string;
    eventType: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    receivedAt?: string;
    createdAt?: string;
    payload?: unknown;
  }>;
  payments?: Array<{ id: string; status: string; amount: string | number; paidDate?: string | null }>;
  relatedInvoice?: { id: string; number: number; year: number; documentType: string } | null;
  creditNotes?: Array<{ id: string; number: number; year: number; documentType: string; status: InvoiceStatus }>;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface InvoiceFilters {
  status?: string;
  sdiStatus?: string;
  year?: number;
  customerProfileId?: string;
}

export interface CreateInvoiceLineData {
  description: string;
  quantity?: number;
  unitPrice: number;
  vatRate: number;
  vatNature?: string;
  discountPercent?: number;
  paymentId?: string;
  studentId?: string;
  courseId?: string;
}

export interface CreateInvoiceData {
  seriesId: string;
  customerProfileId: string;
  documentType?: string;
  issueDate?: string;
  paymentMethod?: string;
  paymentTerms?: Array<{ dueDate?: string; amount?: number; iban?: string }>;
  notes?: string;
  relatedInvoiceId?: string;
  lines: CreateInvoiceLineData[];
}

export interface UpdateInvoiceData {
  customerProfileId?: string;
  paymentMethod?: string;
  paymentTerms?: Array<{ dueDate?: string; amount?: number; iban?: string }>;
  notes?: string | null;
}

export interface CreateCreditNoteData {
  /** Se omesso, storna l'intera fattura */
  partialAmount?: number;
  reason: string;
  seriesId: string;
  notes?: string;
}

export interface CreateInvoiceSeriesData {
  code: string;
  prefix?: string;
  description?: string;
  isDefault?: boolean;
}

export interface InvoiceSettings {
  tenantId: string;
  denominazione: string;
  partitaIva: string;
  codiceFiscale: string;
  regimeFiscale: string;
  iscrizioneREA?: string | null;
  capitaleSociale?: string | number | null;
  socioUnico?: 'SU' | 'SM' | null;
  statoLiquidazione: 'LN' | 'LS';
  indirizzo: string;
  cap: string;
  comune: string;
  provincia?: string | null;
  nazione: string;
  telefono?: string | null;
  email?: string | null;
  sdiProvider: string;
  /** Mai esposte in chiaro: il server ritorna '***' se presenti */
  sdiCredentials?: string | null;
  conservazioneEnabled: boolean;
}

export interface SaveInvoiceSettingsData {
  denominazione: string;
  partitaIva: string;
  codiceFiscale: string;
  regimeFiscale?: string;
  iscrizioneREA?: string | null;
  capitaleSociale?: number | null;
  socioUnico?: 'SU' | 'SM' | null;
  statoLiquidazione?: 'LN' | 'LS';
  indirizzo: string;
  cap: string;
  comune: string;
  provincia?: string | null;
  nazione?: string;
  telefono?: string | null;
  email?: string | null;
  sdiProvider?: string;
  sdiCredentials?: Record<string, unknown> | null;
  conservazioneEnabled?: boolean;
}

export interface CustomerProfileFilters {
  search?: string;
  studentId?: string;
}

export interface CreateCustomerProfileData {
  studentId?: string;
  userId?: string;
  denominazione?: string;
  nome?: string;
  cognome?: string;
  codiceFiscale?: string;
  partitaIva?: string;
  pec?: string;
  codiceDestinatario?: string;
  regimeFiscale?: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia?: string;
  nazione?: string;
  email?: string;
  telefono?: string;
  notes?: string;
}

export type UpdateCustomerProfileData = Partial<Omit<CreateCustomerProfileData, 'studentId' | 'userId' | 'codiceFiscale' | 'partitaIva'>>;

// ---------------------------------------------------------------------------
// Query keys factory
// ---------------------------------------------------------------------------

export const invoicesKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoicesKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...invoicesKeys.lists(), filters] as const,
  details: () => [...invoicesKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoicesKeys.details(), id] as const,
  series: () => [...invoicesKeys.all, 'series'] as const,
  settings: () => [...invoicesKeys.all, 'settings'] as const,
  customerProfiles: () => [...invoicesKeys.all, 'customer-profiles'] as const,
  customerProfileList: (filters: Record<string, unknown>) =>
    [...invoicesKeys.customerProfiles(), filters] as const,
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
// Hook fatture
// ---------------------------------------------------------------------------

/**
 * Lista fatture con paginazione e filtri (status/sdiStatus/year/customerProfileId)
 */
export function useInvoices(page = 1, pageSize = 20, filters: InvoiceFilters = {}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: invoicesKeys.list({ page, pageSize, ...filters }),
    queryFn: async (): Promise<InvoicesResponse> => {
      const qs = buildQuery({ page, pageSize, ...filters });
      const response = await fetch(`/api/invoices${qs}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Dettaglio fattura (con righe, eventi SDI, pagamenti, note di credito)
 */
export function useInvoice(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: invoicesKeys.detail(id),
    queryFn: async (): Promise<{ invoice: Invoice }> => {
      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch invoice: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Crea una nuova fattura in stato DRAFT
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceData): Promise<{ invoice: Invoice }> => {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to create invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
    },
  });
}

/**
 * Aggiorna una fattura DRAFT (PATCH)
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInvoiceData }): Promise<{ invoice: Invoice }> => {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to update invoice');
      return response.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(id) });
    },
  });
}

/**
 * Elimina una fattura DRAFT (le fatture emesse non sono cancellabili)
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!response.ok) await throwApiError(response, 'Failed to delete invoice');
      return response.json();
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: invoicesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
    },
  });
}

/**
 * Emette una fattura DRAFT (assegna il numero progressivo)
 */
export function useIssueInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ invoice: Invoice }> => {
      const response = await fetch(`/api/invoices/${id}/issue`, { method: 'POST' });
      if (!response.ok) await throwApiError(response, 'Failed to issue invoice');
      return response.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(id) });
    },
  });
}

/**
 * Trasmette una fattura emessa al SDI tramite il provider configurato
 */
export function useTransmitInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ invoice: Invoice; providerId: string }> => {
      const response = await fetch(`/api/invoices/${id}/transmit`, { method: 'POST' });
      if (!response.ok) await throwApiError(response, 'Failed to transmit invoice');
      return response.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(id) });
    },
  });
}

/**
 * Crea una nota di credito (TD04) collegata alla fattura originale
 */
export function useCreateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateCreditNoteData }): Promise<{ creditNote: Invoice }> => {
      const response = await fetch(`/api/invoices/${id}/credit-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to create credit note');
      return response.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
      // La fattura originale mostra le note di credito collegate
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook sezionali (series)
// ---------------------------------------------------------------------------

/**
 * Lista sezionali del tenant
 */
export function useInvoiceSeries() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: invoicesKeys.series(),
    queryFn: async (): Promise<{ series: InvoiceSeries[] }> => {
      const response = await fetch('/api/invoices/series');
      if (!response.ok) {
        throw new Error(`Failed to fetch invoice series: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Crea un nuovo sezionale
 */
export function useCreateInvoiceSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceSeriesData): Promise<{ series: InvoiceSeries }> => {
      const response = await fetch('/api/invoices/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to create invoice series');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.series() });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook impostazioni fatturazione
// ---------------------------------------------------------------------------

/**
 * Impostazioni fatturazione del tenant (cedente/prestatore + provider SDI)
 */
export function useInvoiceSettings() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: invoicesKeys.settings(),
    queryFn: async (): Promise<{ settings: InvoiceSettings | null }> => {
      const response = await fetch('/api/invoices/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch invoice settings: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Upsert impostazioni fatturazione (PUT)
 */
export function useSaveInvoiceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveInvoiceSettingsData): Promise<{ settings: InvoiceSettings }> => {
      const response = await fetch('/api/invoices/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to save invoice settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.settings() });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook anagrafiche clienti
// ---------------------------------------------------------------------------

/**
 * Lista anagrafiche clienti con ricerca testuale e filtro studente
 */
export function useCustomerProfiles(filters: CustomerProfileFilters = {}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: invoicesKeys.customerProfileList({ ...filters }),
    queryFn: async (): Promise<{ profiles: InvoiceCustomerProfile[] }> => {
      const qs = buildQuery({ ...filters });
      const response = await fetch(`/api/invoices/customer-profiles${qs}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch customer profiles: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Crea una nuova anagrafica cliente
 */
export function useCreateCustomerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCustomerProfileData): Promise<{ profile: InvoiceCustomerProfile }> => {
      const response = await fetch('/api/invoices/customer-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to create customer profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.customerProfiles() });
    },
  });
}

/**
 * Aggiorna un'anagrafica cliente (PATCH — CF e P.IVA non sono modificabili)
 */
export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCustomerProfileData }): Promise<{ profile: InvoiceCustomerProfile }> => {
      const response = await fetch(`/api/invoices/customer-profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response, 'Failed to update customer profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.customerProfiles() });
      // Le fatture in lista includono i dati dell'anagrafica
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
    },
  });
}
