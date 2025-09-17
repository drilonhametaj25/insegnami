import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  avatar?: string;
  qualifications?: string;
  specializations?: string;
  experience?: number;
  hireDate: Date;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  classes?: {
    id: string;
    name: string;
    level?: string;
    schedule?: string;
    status: string;
    course: {
      id: string;
      name: string;
    };
    _count: {
      students: number;
    };
  }[];
  lessons?: {
    id: string;
    date: Date;
    topic?: string;
    duration?: number;
    status: string;
    class: {
      id: string;
      name: string;
    };
  }[];
}

export interface TeachersResponse {
  teachers: Teacher[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TeacherStats {
  totalTeachers: number;
  activeTeachers: number;
  inactiveTeachers: number;
  newTeachersThisMonth: number;
  avgClassesPerTeacher: number;
}

export interface CreateTeacherData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  qualifications?: string;
  specializations?: string;
  hireDate: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string;
}

// Query Keys
export const teachersKeys = {
  all: ['teachers'] as const,
  lists: () => [...teachersKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...teachersKeys.lists(), filters] as const,
  details: () => [...teachersKeys.all, 'detail'] as const,
  detail: (id: string) => [...teachersKeys.details(), id] as const,
  stats: () => [...teachersKeys.all, 'stats'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista dei docenti con paginazione e filtri
 */
export function useTeachers(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: teachersKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<TeachersResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/teachers?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teachers: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere un singolo docente con dettagli completi
 */
export function useTeacherById(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: teachersKeys.detail(id),
    queryFn: async (): Promise<Teacher> => {
      const response = await fetch(`/api/teachers/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teacher: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere un singolo docente (alias per compatibilità)
 */
export function useTeacher(id: string) {
  return useTeacherById(id);
}

/**
 * Hook per ottenere le statistiche dei docenti
 */
export function useTeacherStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: teachersKeys.stats(),
    queryFn: async (): Promise<TeacherStats> => {
      const response = await fetch('/api/teachers/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teacher stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Hook per creare un nuovo docente
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTeacherData): Promise<Teacher> => {
      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create teacher');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch teachers list
      queryClient.invalidateQueries({ queryKey: teachersKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: teachersKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un docente esistente
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTeacherData> }): Promise<Teacher> => {
      const response = await fetch(`/api/teachers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update teacher');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific teacher in cache
      queryClient.setQueryData(teachersKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: teachersKeys.lists() });
    },
  });
}

/**
 * Hook per eliminare un docente
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/teachers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete teacher');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: teachersKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: teachersKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: teachersKeys.stats() });
    },
  });
}
