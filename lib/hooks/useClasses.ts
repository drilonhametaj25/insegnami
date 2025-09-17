import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Class {
  id: string;
  name: string;
  code: string;
  description?: string;
  schedule?: string;
  maxStudents: number;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  teacherId?: string;
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  course?: {
    id: string;
    name: string;
    level?: string;
  };
  students?: {
    id: string;
    enrolledAt: Date;
    isActive: boolean;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }[];
  lessons?: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }[];
  _count?: {
    students: number;
  };
}

export interface ClassesResponse {
  classes: Class[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ClassStats {
  totalClasses: number;
  activeClasses: number;
  inactiveClasses: number;
  totalStudents: number;
  avgStudentsPerClass: number;
}

export interface CreateClassData {
  name: string;
  level: string;
  description?: string;
  schedule?: string;
  capacity: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  startDate: string;
  endDate?: string;
  teacherId: string;
  courseId: string;
}

// Query Keys
export const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...classesKeys.lists(), filters] as const,
  details: () => [...classesKeys.all, 'detail'] as const,
  detail: (id: string) => [...classesKeys.details(), id] as const,
  stats: () => [...classesKeys.all, 'stats'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista delle classi con paginazione e filtri
 */
export function useClasses(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    teacherId?: string;
    courseId?: string;
    level?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: classesKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<ClassesResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/classes?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch classes: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere una singola classe con dettagli completi
 */
export function useClassById(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: classesKeys.detail(id),
    queryFn: async (): Promise<Class> => {
      const response = await fetch(`/api/classes/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch class: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere una singola classe (alias per compatibilità)
 */
export function useClass(id: string) {
  return useClassById(id);
}

/**
 * Hook per ottenere le statistiche delle classi
 */
export function useClassStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: classesKeys.stats(),
    queryFn: async (): Promise<ClassStats> => {
      const response = await fetch('/api/classes/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch class stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Hook per creare una nuova classe
 */
export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClassData): Promise<Class> => {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create class');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch classes list
      queryClient.invalidateQueries({ queryKey: classesKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: classesKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare una classe esistente
 */
export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateClassData> }): Promise<Class> => {
      const response = await fetch(`/api/classes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update class');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific class in cache
      queryClient.setQueryData(classesKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: classesKeys.lists() });
    },
  });
}

/**
 * Hook per eliminare una classe
 */
export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/classes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete class');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: classesKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: classesKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: classesKeys.stats() });
    },
  });
}

/**
 * Hook per iscrivere uno studente a una classe
 */
export function useEnrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classId, studentId }: { classId: string; studentId: string }): Promise<void> => {
      const response = await fetch(`/api/classes/${classId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enroll student');
      }
    },
    onSuccess: (_, { classId }) => {
      // Invalidate the specific class to update student list
      queryClient.invalidateQueries({ queryKey: classesKeys.detail(classId) });
      // Invalidate classes list to update counts
      queryClient.invalidateQueries({ queryKey: classesKeys.lists() });
    },
  });
}

/**
 * Hook per disiscrivere uno studente da una classe
 */
export function useUnenrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classId, studentId }: { classId: string; studentId: string }): Promise<void> => {
      const response = await fetch(`/api/classes/${classId}/unenroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unenroll student');
      }
    },
    onSuccess: (_, { classId }) => {
      // Invalidate the specific class to update student list
      queryClient.invalidateQueries({ queryKey: classesKeys.detail(classId) });
      // Invalidate classes list to update counts
      queryClient.invalidateQueries({ queryKey: classesKeys.lists() });
    },
  });
}
