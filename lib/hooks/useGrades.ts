import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { GradeType } from '@prisma/client';

// Types
export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  periodId: string | null;
  tenantId: string;
  value: number;
  valueText: string | null;
  weight: number;
  type: GradeType;
  description: string | null;
  date: Date;
  isVisible: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  };
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  class?: {
    id: string;
    name: string;
    code: string;
  };
  period?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface GradesResponse {
  grades: Grade[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StudentGradesResponse {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  };
  subjectGrades: SubjectGrades[];
  overallAverage: number;
  totalGrades: number;
}

export interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string | null;
  grades: Grade[];
  averages: {
    overall: number;
    oral: number;
    written: number;
    practical: number;
    gradeCount: number;
  };
}

export interface ClassGradesResponse {
  class: {
    id: string;
    name: string;
    code: string;
    course: any;
  };
  subject: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  };
  students: StudentWithGrades[];
  dates: string[];
  statistics: {
    totalStudents: number;
    studentsWithGrades: number;
    classAverage: number | null;
    distribution: {
      insufficienti: number;
      sufficienti: number;
      buoni: number;
      ottimi: number;
    };
  };
}

export interface StudentWithGrades {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  grades: Grade[];
  gradeCount: number;
  average: number | null;
}

export interface CreateGradeData {
  studentId: string;
  subjectId: string;
  classId: string;
  periodId?: string | null;
  value: number;
  valueText?: string | null;
  weight?: number;
  type?: GradeType;
  description?: string | null;
  date: string;
  isVisible?: boolean;
  notes?: string | null;
}

export interface BulkGradeData {
  classId: string;
  subjectId: string;
  periodId?: string | null;
  type?: GradeType;
  description?: string | null;
  date: string;
  weight?: number;
  grades: Array<{
    studentId: string;
    value: number;
    notes?: string | null;
  }>;
}

// Query Keys
export const gradesKeys = {
  all: ['grades'] as const,
  lists: () => [...gradesKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...gradesKeys.lists(), filters] as const,
  details: () => [...gradesKeys.all, 'detail'] as const,
  detail: (id: string) => [...gradesKeys.details(), id] as const,
  student: (studentId: string, filters?: Record<string, any>) =>
    [...gradesKeys.all, 'student', studentId, filters] as const,
  classSubject: (classId: string, subjectId: string, filters?: Record<string, any>) =>
    [...gradesKeys.all, 'class', classId, 'subject', subjectId, filters] as const,
};

// Hooks

/**
 * Hook to get paginated list of grades
 */
export function useGrades(
  page = 1,
  limit = 50,
  filters: {
    studentId?: string;
    subjectId?: string;
    classId?: string;
    periodId?: string;
    teacherId?: string;
    type?: GradeType;
    dateFrom?: string;
    dateTo?: string;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: gradesKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<GradesResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      Object.entries(filters).forEach(([key, value]) => {
        if (value) searchParams.set(key, value);
      });

      const response = await fetch(`/api/grades?${searchParams}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei voti');
      }
      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook to get a single grade
 */
export function useGrade(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: gradesKeys.detail(id),
    queryFn: async (): Promise<Grade> => {
      const response = await fetch(`/api/grades/${id}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento del voto');
      }
      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook to get all grades for a student with averages
 */
export function useStudentGrades(
  studentId: string,
  filters: {
    periodId?: string;
    classId?: string;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: gradesKeys.student(studentId, filters),
    queryFn: async (): Promise<StudentGradesResponse> => {
      const searchParams = new URLSearchParams();
      if (filters.periodId) searchParams.set('periodId', filters.periodId);
      if (filters.classId) searchParams.set('classId', filters.classId);

      const response = await fetch(
        `/api/grades/student/${studentId}?${searchParams}`
      );
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei voti dello studente');
      }
      return response.json();
    },
    enabled: !!session?.user && !!studentId,
  });
}

/**
 * Hook to get grade grid for class/subject
 */
export function useClassSubjectGrades(
  classId: string,
  subjectId: string,
  filters: {
    periodId?: string;
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: gradesKeys.classSubject(classId, subjectId, filters),
    queryFn: async (): Promise<ClassGradesResponse> => {
      const searchParams = new URLSearchParams();
      if (filters.periodId) searchParams.set('periodId', filters.periodId);

      const response = await fetch(
        `/api/grades/class/${classId}/subject/${subjectId}?${searchParams}`
      );
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei voti della classe');
      }
      return response.json();
    },
    enabled: !!session?.user && !!classId && !!subjectId,
  });
}

/**
 * Hook to create a grade
 */
export function useCreateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGradeData): Promise<Grade> => {
      const response = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione del voto');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gradesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gradesKeys.student(data.studentId) });
      queryClient.invalidateQueries({
        queryKey: gradesKeys.classSubject(data.classId, data.subjectId),
      });
    },
  });
}

/**
 * Hook to update a grade
 */
export function useUpdateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateGradeData>;
    }): Promise<Grade> => {
      const response = await fetch(`/api/grades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento del voto');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(gradesKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: gradesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gradesKeys.student(data.studentId) });
      queryClient.invalidateQueries({
        queryKey: gradesKeys.classSubject(data.classId, data.subjectId),
      });
    },
  });
}

/**
 * Hook to delete a grade
 */
export function useDeleteGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; message: string }> => {
      const response = await fetch(`/api/grades/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'eliminazione del voto');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gradesKeys.all });
    },
  });
}

/**
 * Hook to create bulk grades
 */
export function useCreateBulkGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkGradeData): Promise<{ message: string; grades: Grade[] }> => {
      const response = await fetch('/api/grades/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'inserimento multiplo dei voti');
      }

      return response.json();
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: gradesKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: gradesKeys.classSubject(data.classId, data.subjectId),
      });
      // Invalidate all student queries since we don't know which students were affected
      queryClient.invalidateQueries({ queryKey: [...gradesKeys.all, 'student'] });
    },
  });
}

// Helper function to get grade color based on value
export function getGradeColor(value: number): string {
  if (value < 5) return '#ef4444'; // Red - Grave insufficienza
  if (value < 6) return '#f97316'; // Orange - Insufficiente
  if (value === 6) return '#eab308'; // Yellow - Sufficiente
  if (value < 7) return '#84cc16'; // Lime - Più che sufficiente
  if (value < 8) return '#22c55e'; // Green - Buono
  if (value < 9) return '#14b8a6'; // Teal - Distinto
  return '#0ea5e9'; // Sky - Ottimo/Eccellente
}

// Helper function to format grade display
export function formatGrade(value: number): string {
  const rounded = Math.round(value * 2) / 2; // Round to nearest 0.5
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
}

// Grade type labels in Italian
export const gradeTypeLabels: Record<GradeType, string> = {
  ORAL: 'Orale',
  WRITTEN: 'Scritto',
  PRACTICAL: 'Pratico',
  HOMEWORK: 'Compiti',
  PROJECT: 'Progetto',
  TEST: 'Test',
  BEHAVIOR: 'Condotta',
};
