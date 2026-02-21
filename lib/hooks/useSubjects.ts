import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Subject {
  id: string;
  name: string;
  code: string;
  color: string | null;
  icon: string | null;
  weeklyHours: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  teachers: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
  _count?: {
    grades: number;
    homework: number;
    classSubjects: number;
  };
}

export interface SubjectDetail extends Subject {
  classSubjects: {
    classId: string;
    className: string;
    classCode: string;
    teacherId: string;
    teacherName: string;
    weeklyHours: number;
  }[];
}

export interface SubjectsResponse {
  subjects: Subject[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SubjectStats {
  totalSubjects: number;
  activeSubjects: number;
  inactiveSubjects: number;
  subjectsWithTeachers: number;
  subjectsWithGrades: number;
  subjectsWithHomework: number;
  totalGrades: number;
  totalHomework: number;
  avgGradesPerSubject: number | string;
  avgHomeworkPerSubject: number | string;
  topSubjectsByGrades: {
    id: string;
    name: string;
    code: string;
    color: string | null;
    gradesCount: number;
  }[];
  weeklyHoursDistribution: {
    hours: number | null;
    count: number;
  }[];
}

export interface CreateSubjectData {
  name: string;
  code: string;
  color?: string;
  icon?: string | null;
  weeklyHours?: number | null;
  isActive?: boolean;
}

// Query Keys
export const subjectsKeys = {
  all: ['subjects'] as const,
  lists: () => [...subjectsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...subjectsKeys.lists(), filters] as const,
  details: () => [...subjectsKeys.all, 'detail'] as const,
  detail: (id: string) => [...subjectsKeys.details(), id] as const,
  stats: () => [...subjectsKeys.all, 'stats'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista delle materie con paginazione e filtri
 */
export function useSubjects(
  page = 1,
  limit = 50,
  filters: {
    search?: string;
    isActive?: boolean;
    all?: boolean;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: subjectsKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<SubjectsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive.toString() }),
        ...(filters.all && { all: 'true' }),
      });

      const response = await fetch(`/api/subjects?${searchParams}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento delle materie');
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere una singola materia
 */
export function useSubject(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: subjectsKeys.detail(id),
    queryFn: async (): Promise<SubjectDetail> => {
      const response = await fetch(`/api/subjects/${id}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento della materia');
      }
      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere le statistiche delle materie
 */
export function useSubjectStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: subjectsKeys.stats(),
    queryFn: async (): Promise<SubjectStats> => {
      const response = await fetch('/api/subjects/stats');
      if (!response.ok) {
        throw new Error('Errore nel caricamento delle statistiche');
      }
      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook per creare una nuova materia
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubjectData): Promise<Subject> => {
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione della materia');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subjectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: subjectsKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare una materia
 */
export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateSubjectData>;
    }): Promise<Subject> => {
      const response = await fetch(`/api/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento della materia');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(subjectsKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: subjectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: subjectsKeys.stats() });
    },
  });
}

/**
 * Hook per eliminare una materia
 */
export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; message: string; deleted?: boolean; deactivated?: boolean }> => {
      const response = await fetch(`/api/subjects/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'eliminazione della materia');
      }

      return response.json();
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: subjectsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: subjectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: subjectsKeys.stats() });
    },
  });
}
