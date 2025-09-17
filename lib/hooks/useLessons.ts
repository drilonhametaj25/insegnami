import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Lesson {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  room?: string;
  notes?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  materials?: string;
  homework?: string;
  createdAt: Date;
  updatedAt: Date;
  course: {
    id: string;
    name: string;
    code?: string;
    description?: string;
    level?: string;
    color?: string;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  class: {
    id: string;
    name: string;
    level?: string;
    description?: string;
    course?: {
      id: string;
      name: string;
      description?: string;
    };
    students?: {
      id: string;
      studentId: string;
      isActive: boolean;
      student: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }[];
  };
  attendance: {
    id: string;
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    notes?: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }[];
}

export interface LessonsResponse {
  lessons: Lesson[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LessonStats {
  totalLessons: number;
  scheduledLessons: number;
  completedLessons: number;
  cancelledLessons: number;
  lessonsThisWeek: number;
  lessonsThisMonth: number;
  averageAttendance: number;
}

export interface CreateLessonData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  courseId: string;
  classId: string;
  teacherId: string;
  location?: string;
  maxStudents?: number;
  notes?: string;
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    endDate?: string;
    daysOfWeek?: number[];
  };
}

export interface AttendanceData {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string;
}

// Query Keys
export const lessonsKeys = {
  all: ['lessons'] as const,
  lists: () => [...lessonsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...lessonsKeys.lists(), filters] as const,
  details: () => [...lessonsKeys.all, 'detail'] as const,
  detail: (id: string) => [...lessonsKeys.details(), id] as const,
  stats: () => [...lessonsKeys.all, 'stats'] as const,
  calendar: () => [...lessonsKeys.all, 'calendar'] as const,
  attendance: () => [...lessonsKeys.all, 'attendance'] as const,
  attendanceByLesson: (lessonId: string) => [...lessonsKeys.attendance(), lessonId] as const,
};

// Hooks

/**
 * Hook per ottenere la lista delle lezioni con paginazione e filtri
 */
export function useLessons(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    courseId?: string;
    classId?: string;
    teacherId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: lessonsKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<LessonsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/lessons?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lessons: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere le lezioni del calendario
 */
export function useCalendarLessons(
  startDate?: string,
  endDate?: string,
  teacherId?: string,
  classId?: string
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: lessonsKeys.calendar(),
    queryFn: async (): Promise<Lesson[]> => {
      const searchParams = new URLSearchParams({
        calendar: 'true',
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(teacherId && { teacherId }),
        ...(classId && { classId }),
      });

      const response = await fetch(`/api/lessons?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar lessons: ${response.statusText}`);
      }

      const data = await response.json();
      return data.lessons || data;
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for calendar data
  });
}

/**
 * Hook per ottenere un singola lezione con dettagli completi
 */
export function useLessonById(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: lessonsKeys.detail(id),
    queryFn: async (): Promise<Lesson> => {
      const response = await fetch(`/api/lessons/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lesson: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere un singola lezione (alias per compatibilità)
 */
export function useLesson(id: string) {
  return useLessonById(id);
}

/**
 * Hook per ottenere le statistiche delle lezioni
 */
export function useLessonStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: lessonsKeys.stats(),
    queryFn: async (): Promise<LessonStats> => {
      const response = await fetch('/api/lessons/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lesson stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes for stats
  });
}

/**
 * Hook per ottenere le presenze di una lezione
 */
export function useLessonAttendance(lessonId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: lessonsKeys.attendanceByLesson(lessonId),
    queryFn: async () => {
      const response = await fetch(`/api/attendance?lessonId=${lessonId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lesson attendance: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!lessonId,
  });
}

/**
 * Hook per creare una nuova lezione
 */
export function useCreateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLessonData): Promise<Lesson> => {
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create lesson');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch lessons list
      queryClient.invalidateQueries({ queryKey: lessonsKeys.lists() });
      // Invalidate calendar
      queryClient.invalidateQueries({ queryKey: lessonsKeys.calendar() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: lessonsKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare una lezione esistente
 */
export function useUpdateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateLessonData> }): Promise<Lesson> => {
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update lesson');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific lesson in cache
      queryClient.setQueryData(lessonsKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: lessonsKeys.lists() });
      // Invalidate calendar
      queryClient.invalidateQueries({ queryKey: lessonsKeys.calendar() });
    },
  });
}

/**
 * Hook per eliminare una lezione
 */
export function useDeleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete lesson');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: lessonsKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: lessonsKeys.lists() });
      // Invalidate calendar
      queryClient.invalidateQueries({ queryKey: lessonsKeys.calendar() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: lessonsKeys.stats() });
    },
  });
}

/**
 * Hook per registrare le presenze di una lezione
 */
export function useRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, attendance }: { 
      lessonId: string; 
      attendance: AttendanceData[] 
    }): Promise<void> => {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId,
          attendance,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record attendance');
      }

      return response.json();
    },
    onSuccess: (_, { lessonId }) => {
      // Invalidate attendance for this lesson
      queryClient.invalidateQueries({ queryKey: lessonsKeys.attendanceByLesson(lessonId) });
      // Invalidate lesson details (may include attendance summary)
      queryClient.invalidateQueries({ queryKey: lessonsKeys.detail(lessonId) });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: lessonsKeys.stats() });
    },
  });
}

/**
 * Hook per completare una lezione
 */
export function useCompleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }): Promise<Lesson> => {
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          ...(notes && { notes }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete lesson');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific lesson in cache
      queryClient.setQueryData(lessonsKeys.detail(id), data);
      // Invalidate lists and calendar
      queryClient.invalidateQueries({ queryKey: lessonsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: lessonsKeys.calendar() });
      queryClient.invalidateQueries({ queryKey: lessonsKeys.stats() });
    },
  });
}

/**
 * Hook per cancellare una lezione
 */
export function useCancelLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }): Promise<Lesson> => {
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'CANCELLED',
          ...(reason && { notes: reason }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel lesson');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific lesson in cache
      queryClient.setQueryData(lessonsKeys.detail(id), data);
      // Invalidate lists and calendar
      queryClient.invalidateQueries({ queryKey: lessonsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: lessonsKeys.calendar() });
      queryClient.invalidateQueries({ queryKey: lessonsKeys.stats() });
    },
  });
}
