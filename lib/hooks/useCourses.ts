import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Course {
  id: string;
  name: string;
  description?: string;
  level: string;
  duration?: number; // in hours
  price?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
  classes: {
    id: string;
    name: string;
    startDate: Date;
    endDate?: Date;
    _count: {
      students: number;
    };
  }[];
  _count: {
    classes: number;
  };
}

export interface CoursesResponse {
  courses: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CourseStats {
  totalCourses: number;
  activeCourses: number;
  inactiveCourses: number;
  totalClasses: number;
  avgClassesPerCourse: number;
}

export interface CreateCourseData {
  name: string;
  description?: string;
  level: string;
  duration?: number;
  price?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

// Query Keys
export const coursesKeys = {
  all: ['courses'] as const,
  lists: () => [...coursesKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...coursesKeys.lists(), filters] as const,
  details: () => [...coursesKeys.all, 'detail'] as const,
  detail: (id: string) => [...coursesKeys.details(), id] as const,
  stats: () => [...coursesKeys.all, 'stats'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista dei corsi con paginazione e filtri
 */
export function useCourses(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    level?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: coursesKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<CoursesResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/courses?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere un singolo corso
 */
export function useCourse(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: coursesKeys.detail(id),
    queryFn: async (): Promise<Course> => {
      const response = await fetch(`/api/courses/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch course: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere le statistiche dei corsi
 */
export function useCourseStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: coursesKeys.stats(),
    queryFn: async (): Promise<CourseStats> => {
      const response = await fetch('/api/courses/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch course stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Hook per creare un nuovo corso
 */
export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCourseData): Promise<Course> => {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create course');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch courses list
      queryClient.invalidateQueries({ queryKey: coursesKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: coursesKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un corso esistente
 */
export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCourseData> }): Promise<Course> => {
      const response = await fetch(`/api/courses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update course');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific course in cache
      queryClient.setQueryData(coursesKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: coursesKeys.lists() });
    },
  });
}

/**
 * Hook per eliminare un corso
 */
export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete course');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: coursesKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: coursesKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: coursesKeys.stats() });
    },
  });
}
