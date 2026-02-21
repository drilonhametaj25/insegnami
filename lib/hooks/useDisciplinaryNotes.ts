'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DisciplinaryType, Severity } from '@prisma/client';

// Types
export interface DisciplinaryNote {
  id: string;
  tenantId: string;
  studentId: string;
  teacherId: string;
  classId: string;
  type: DisciplinaryType;
  severity: Severity;
  title: string;
  description: string;
  date: string;
  parentNotified: boolean;
  parentNotifiedAt: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
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
}

export interface DisciplinaryNoteFilters {
  studentId?: string;
  classId?: string;
  teacherId?: string;
  type?: DisciplinaryType;
  severity?: Severity;
  resolved?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface DisciplinaryNotesResponse {
  data: DisciplinaryNote[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface StudentDisciplinaryNotesResponse {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  };
  notes: DisciplinaryNote[];
  statistics: {
    total: number;
    resolved: number;
    unresolved: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

export interface CreateDisciplinaryNoteData {
  studentId: string;
  classId: string;
  teacherId?: string;
  type?: DisciplinaryType;
  severity?: Severity;
  title: string;
  description: string;
  date: string;
}

export interface UpdateDisciplinaryNoteData {
  type?: DisciplinaryType;
  severity?: Severity;
  title?: string;
  description?: string;
  date?: string;
  resolved?: boolean;
  resolution?: string | null;
}

// Query keys
export const disciplinaryNotesKeys = {
  all: ['disciplinaryNotes'] as const,
  lists: () => [...disciplinaryNotesKeys.all, 'list'] as const,
  list: (filters: DisciplinaryNoteFilters) =>
    [...disciplinaryNotesKeys.lists(), filters] as const,
  details: () => [...disciplinaryNotesKeys.all, 'detail'] as const,
  detail: (id: string) => [...disciplinaryNotesKeys.details(), id] as const,
  student: (studentId: string, filters?: { type?: string; resolved?: boolean }) =>
    [...disciplinaryNotesKeys.all, 'student', studentId, filters] as const,
};

// Helper to build query string
function buildQueryString(filters: DisciplinaryNoteFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

// Fetch functions
async function fetchDisciplinaryNotes(
  filters: DisciplinaryNoteFilters = {}
): Promise<DisciplinaryNotesResponse> {
  const queryString = buildQueryString(filters);
  const url = `/api/disciplinary-notes${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento delle note');
  }
  return response.json();
}

async function fetchDisciplinaryNote(id: string): Promise<DisciplinaryNote> {
  const response = await fetch(`/api/disciplinary-notes/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Nota disciplinare non trovata');
  }
  return response.json();
}

async function fetchStudentDisciplinaryNotes(
  studentId: string,
  filters?: { type?: string; resolved?: boolean }
): Promise<StudentDisciplinaryNotesResponse> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.resolved !== undefined) {
    params.append('resolved', String(filters.resolved));
  }
  const queryString = params.toString();
  const url = `/api/disciplinary-notes/student/${studentId}${
    queryString ? `?${queryString}` : ''
  }`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento delle note');
  }
  return response.json();
}

async function createDisciplinaryNote(
  data: CreateDisciplinaryNoteData
): Promise<DisciplinaryNote> {
  const response = await fetch('/api/disciplinary-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nella creazione della nota');
  }
  return response.json();
}

async function updateDisciplinaryNote({
  id,
  data,
}: {
  id: string;
  data: UpdateDisciplinaryNoteData;
}): Promise<DisciplinaryNote> {
  const response = await fetch(`/api/disciplinary-notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'aggiornamento della nota');
  }
  return response.json();
}

async function deleteDisciplinaryNote(id: string): Promise<void> {
  const response = await fetch(`/api/disciplinary-notes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'eliminazione della nota');
  }
}

// Hooks
export function useDisciplinaryNotes(filters: DisciplinaryNoteFilters = {}) {
  return useQuery({
    queryKey: disciplinaryNotesKeys.list(filters),
    queryFn: () => fetchDisciplinaryNotes(filters),
  });
}

export function useDisciplinaryNote(id: string) {
  return useQuery({
    queryKey: disciplinaryNotesKeys.detail(id),
    queryFn: () => fetchDisciplinaryNote(id),
    enabled: !!id,
  });
}

export function useStudentDisciplinaryNotes(
  studentId: string,
  filters?: { type?: string; resolved?: boolean }
) {
  return useQuery({
    queryKey: disciplinaryNotesKeys.student(studentId, filters),
    queryFn: () => fetchStudentDisciplinaryNotes(studentId, filters),
    enabled: !!studentId,
  });
}

export function useCreateDisciplinaryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDisciplinaryNote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: disciplinaryNotesKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: disciplinaryNotesKeys.student(data.studentId),
      });
    },
  });
}

export function useUpdateDisciplinaryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDisciplinaryNote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: disciplinaryNotesKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: disciplinaryNotesKeys.detail(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: disciplinaryNotesKeys.student(data.studentId),
      });
    },
  });
}

export function useDeleteDisciplinaryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDisciplinaryNote,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: disciplinaryNotesKeys.all,
      });
    },
  });
}

// Utility functions
export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'LOW':
      return 'blue';
    case 'MEDIUM':
      return 'yellow';
    case 'HIGH':
      return 'orange';
    case 'CRITICAL':
      return 'red';
    default:
      return 'gray';
  }
}

export function getTypeColor(type: DisciplinaryType): string {
  switch (type) {
    case 'NOTE':
      return 'blue';
    case 'WARNING':
      return 'orange';
    case 'SUSPENSION':
      return 'red';
    case 'POSITIVE':
      return 'green';
    default:
      return 'gray';
  }
}

export function getTypeIcon(type: DisciplinaryType): string {
  switch (type) {
    case 'NOTE':
      return '📝';
    case 'WARNING':
      return '⚠️';
    case 'SUSPENSION':
      return '🚫';
    case 'POSITIVE':
      return '⭐';
    default:
      return '📋';
  }
}
