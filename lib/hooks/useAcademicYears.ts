import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { PeriodType } from '@prisma/client';

// Types
export interface AcademicPeriod {
  id: string;
  name: string;
  type: PeriodType;
  startDate: Date;
  endDate: Date;
  orderIndex: number;
  academicYearId: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    grades: number;
    reportCards: number;
  };
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  periods: AcademicPeriod[];
  currentPeriod?: AcademicPeriod | null;
  _count?: {
    grades: number;
    reportCards: number;
  };
}

export interface AcademicYearsResponse {
  academicYears: AcademicYear[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAcademicYearData {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

export interface CreatePeriodData {
  name: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  orderIndex?: number;
}

// Query Keys
export const academicYearsKeys = {
  all: ['academicYears'] as const,
  lists: () => [...academicYearsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...academicYearsKeys.lists(), filters] as const,
  details: () => [...academicYearsKeys.all, 'detail'] as const,
  detail: (id: string) => [...academicYearsKeys.details(), id] as const,
  current: () => [...academicYearsKeys.all, 'current'] as const,
  periods: (yearId: string) => [...academicYearsKeys.all, 'periods', yearId] as const,
};

// Hooks

/**
 * Hook per ottenere la lista degli anni scolastici
 */
export function useAcademicYears(
  page = 1,
  limit = 50,
  filters: {
    all?: boolean;
    current?: boolean;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: academicYearsKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<AcademicYearsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.all && { all: 'true' }),
        ...(filters.current && { current: 'true' }),
      });

      const response = await fetch(`/api/academic-years?${searchParams}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli anni scolastici');
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere un singolo anno scolastico
 */
export function useAcademicYear(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: academicYearsKeys.detail(id),
    queryFn: async (): Promise<AcademicYear> => {
      const response = await fetch(`/api/academic-years/${id}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento dell\'anno scolastico');
      }
      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere l'anno scolastico corrente
 */
export function useCurrentAcademicYear() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: academicYearsKeys.current(),
    queryFn: async (): Promise<AcademicYear | null> => {
      const response = await fetch('/api/academic-years/current');
      if (!response.ok) {
        throw new Error('Errore nel caricamento dell\'anno scolastico corrente');
      }
      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook per creare un nuovo anno scolastico
 */
export function useCreateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAcademicYearData): Promise<AcademicYear> => {
      const response = await fetch('/api/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione dell\'anno scolastico');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.current() });
    },
  });
}

/**
 * Hook per aggiornare un anno scolastico
 */
export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateAcademicYearData>;
    }): Promise<AcademicYear> => {
      const response = await fetch(`/api/academic-years/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento dell\'anno scolastico');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(academicYearsKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.current() });
    },
  });
}

/**
 * Hook per eliminare un anno scolastico
 */
export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; message: string }> => {
      const response = await fetch(`/api/academic-years/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'eliminazione dell\'anno scolastico');
      }

      return response.json();
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: academicYearsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.current() });
    },
  });
}

/**
 * Hook per impostare l'anno scolastico corrente
 */
export function useSetCurrentAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (academicYearId: string): Promise<AcademicYear> => {
      const response = await fetch('/api/academic-years/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'impostazione dell\'anno scolastico corrente');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.current() });
    },
  });
}

/**
 * Hook per creare un periodo
 */
export function useCreatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      academicYearId,
      data,
    }: {
      academicYearId: string;
      data: CreatePeriodData;
    }): Promise<AcademicPeriod> => {
      const response = await fetch(`/api/academic-years/${academicYearId}/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione del periodo');
      }

      return response.json();
    },
    onSuccess: (_, { academicYearId }) => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.detail(academicYearId) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.periods(academicYearId) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
    },
  });
}

/**
 * Hook per aggiornare un periodo
 */
export function useUpdatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      academicYearId,
      periodId,
      data,
    }: {
      academicYearId: string;
      periodId: string;
      data: Partial<CreatePeriodData>;
    }): Promise<AcademicPeriod> => {
      const response = await fetch(`/api/academic-years/${academicYearId}/periods/${periodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento del periodo');
      }

      return response.json();
    },
    onSuccess: (_, { academicYearId }) => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.detail(academicYearId) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.periods(academicYearId) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
    },
  });
}

/**
 * Hook per eliminare un periodo
 */
export function useDeletePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      academicYearId,
      periodId,
    }: {
      academicYearId: string;
      periodId: string;
    }): Promise<{ success: boolean; message: string }> => {
      const response = await fetch(`/api/academic-years/${academicYearId}/periods/${periodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'eliminazione del periodo');
      }

      return response.json();
    },
    onSuccess: (_, { academicYearId }) => {
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.detail(academicYearId) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.periods(academicYearId) });
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.lists() });
    },
  });
}
