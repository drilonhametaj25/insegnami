import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth: Date;
  enrollmentDate: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  studentCode?: string;
  address?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  classes: {
    id: string;
    name: string;
    level: string;
    description?: string;
    status?: string;
    schedule?: string;
    enrolledAt?: Date;
    course?: {
      id: string;
      name: string;
    };
    teacher?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
}

export interface StudentsResponse {
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StudentStats {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  newStudentsThisMonth: number;
  enrollmentTrend: {
    month: string;
    count: number;
  }[];
}

export interface CreateStudentData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth: string;
  enrollmentDate: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string;
}

// Query Keys
export const studentsKeys = {
  all: ['students'] as const,
  lists: () => [...studentsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...studentsKeys.lists(), filters] as const,
  details: () => [...studentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...studentsKeys.details(), id] as const,
  stats: () => [...studentsKeys.all, 'stats'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista degli studenti con paginazione e filtri
 */
export function useStudents(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    classId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: studentsKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<StudentsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/students?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch students: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere un singolo studente
 */
export function useStudent(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: studentsKeys.detail(id),
    queryFn: async (): Promise<Student> => {
      const response = await fetch(`/api/students/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Alias per useStudent per compatibilità
 */
export function useStudentById(id: string) {
  return useStudent(id);
}

/**
 * Hook per ottenere le statistiche degli studenti
 */
export function useStudentStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: studentsKeys.stats(),
    queryFn: async (): Promise<StudentStats> => {
      const response = await fetch('/api/students/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Hook per creare un nuovo studente
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStudentData): Promise<Student> => {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create student');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: studentsKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: studentsKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un studente esistente
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateStudentData> }): Promise<Student> => {
      const response = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update student');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific student in cache
      queryClient.setQueryData(studentsKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: studentsKeys.lists() });
    },
  });
}

/**
 * Hook per eliminare un studente
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete student');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: studentsKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: studentsKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: studentsKeys.stats() });
    },
  });
}
