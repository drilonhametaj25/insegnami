import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface AttendanceRecord {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    registrationNumber?: string;
  };
  lesson: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    course: {
      id: string;
      name: string;
      code: string;
    };
    teacher: {
      id: string;
      firstName: string;
      lastName: string;
    };
    class: {
      id: string;
      name: string;
    };
  };
}

export interface AttendanceResponse {
  attendance: AttendanceRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AttendanceStats {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRate: number;
  recentTrend: 'improving' | 'declining' | 'stable';
}

export interface StudentAttendanceSummary {
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    registrationNumber?: string;
  };
  totalLessons: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRate: number;
  recentRecords: AttendanceRecord[];
}

export interface ClassAttendanceSummary {
  classId: string;
  class: {
    id: string;
    name: string;
    level?: string;
  };
  totalStudents: number;
  totalLessons: number;
  averageAttendanceRate: number;
  studentSummaries: StudentAttendanceSummary[];
  recentLessons: {
    lessonId: string;
    lesson: {
      id: string;
      title: string;
      startTime: Date;
    };
    attendanceRate: number;
    presentCount: number;
    totalStudents: number;
  }[];
}

export interface CreateAttendanceData {
  lessonId: string;
  attendance: {
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    notes?: string;
  }[];
}

export interface UpdateAttendanceData {
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string;
}

// Query Keys
export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...attendanceKeys.lists(), filters] as const,
  details: () => [...attendanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...attendanceKeys.details(), id] as const,
  stats: () => [...attendanceKeys.all, 'stats'] as const,
  studentStats: (studentId: string) => [...attendanceKeys.stats(), 'student', studentId] as const,
  classStats: (classId: string) => [...attendanceKeys.stats(), 'class', classId] as const,
  lessonAttendance: (lessonId: string) => [...attendanceKeys.all, 'lesson', lessonId] as const,
  studentSummary: (studentId: string) => [...attendanceKeys.all, 'student-summary', studentId] as const,
  classSummary: (classId: string) => [...attendanceKeys.all, 'class-summary', classId] as const,
};

// Hooks

/**
 * Hook per ottenere la lista delle presenze con paginazione e filtri
 */
export function useAttendance(
  page = 1,
  limit = 20,
  filters: {
    studentId?: string;
    lessonId?: string;
    classId?: string;
    teacherId?: string;
    courseId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<AttendanceResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/attendance?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch attendance: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere le presenze di una specifica lezione
 */
export function useLessonAttendance(lessonId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.lessonAttendance(lessonId),
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const response = await fetch(`/api/attendance?lessonId=${lessonId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lesson attendance: ${response.statusText}`);
      }

      const data = await response.json();
      return data.attendance || data;
    },
    enabled: !!session?.user && !!lessonId,
  });
}

/**
 * Hook per ottenere un singolo record di presenza
 */
export function useAttendanceRecord(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.detail(id),
    queryFn: async (): Promise<AttendanceRecord> => {
      const response = await fetch(`/api/attendance/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch attendance record: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere le statistiche generali delle presenze
 */
export function useAttendanceStats(
  filters: {
    classId?: string;
    courseId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.stats(),
    queryFn: async (): Promise<AttendanceStats> => {
      const searchParams = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      );

      const response = await fetch(`/api/attendance/stats?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch attendance stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes for stats
  });
}

/**
 * Hook per ottenere le statistiche di presenza di uno studente
 */
export function useStudentAttendanceStats(
  studentId: string,
  filters: {
    classId?: string;
    courseId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.studentStats(studentId),
    queryFn: async (): Promise<AttendanceStats> => {
      const searchParams = new URLSearchParams({
        studentId,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/attendance/stats?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student attendance stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!studentId,
    staleTime: 2 * 60 * 1000, // 2 minutes for individual stats
  });
}

/**
 * Hook per ottenere il riassunto delle presenze di uno studente
 */
export function useStudentAttendanceSummary(
  studentId: string,
  timeframe: 'week' | 'month' | 'semester' | 'year' = 'month'
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.studentSummary(studentId),
    queryFn: async (): Promise<StudentAttendanceSummary> => {
      const response = await fetch(`/api/attendance/summary/student/${studentId}?timeframe=${timeframe}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student attendance summary: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!studentId,
    staleTime: 5 * 60 * 1000, // 5 minutes for summaries
  });
}

/**
 * Hook per ottenere il riassunto delle presenze di una classe
 */
export function useClassAttendanceSummary(
  classId: string,
  timeframe: 'week' | 'month' | 'semester' | 'year' = 'month'
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: attendanceKeys.classSummary(classId),
    queryFn: async (): Promise<ClassAttendanceSummary> => {
      const response = await fetch(`/api/attendance/summary/class/${classId}?timeframe=${timeframe}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch class attendance summary: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!classId,
    staleTime: 5 * 60 * 1000, // 5 minutes for summaries
  });
}

/**
 * Hook per registrare le presenze di una lezione
 */
export function useRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAttendanceData): Promise<AttendanceRecord[]> => {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record attendance');
      }

      return response.json();
    },
    onSuccess: (_, { lessonId }) => {
      // Invalidate lesson attendance
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lessonAttendance(lessonId) });
      // Invalidate attendance lists
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: attendanceKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un record di presenza
 */
export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAttendanceData }): Promise<AttendanceRecord> => {
      const response = await fetch(`/api/attendance/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update attendance');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific record in cache
      queryClient.setQueryData(attendanceKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
      // Invalidate lesson attendance if applicable
      if (data.lesson?.id) {
        queryClient.invalidateQueries({ queryKey: attendanceKeys.lessonAttendance(data.lesson.id) });
      }
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: attendanceKeys.stats() });
    },
  });
}

/**
 * Hook per eliminare un record di presenza
 */
export function useDeleteAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete attendance record');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: attendanceKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: attendanceKeys.stats() });
    },
  });
}

/**
 * Hook per esportare i dati delle presenze
 */
export function useExportAttendance() {
  return useMutation({
    mutationFn: async (filters: {
      format: 'csv' | 'xlsx' | 'pdf';
      classId?: string;
      studentId?: string;
      courseId?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<Blob> => {
      const searchParams = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      );

      const response = await fetch(`/api/attendance/export?${searchParams}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export attendance');
      }

      return response.blob();
    },
    onSuccess: (blob, { format }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}
