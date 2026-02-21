'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Homework {
  id: string;
  tenantId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  lessonId: string | null;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  attachments: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
    code: string;
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
  lesson?: {
    id: string;
    title: string;
    startTime: string;
  } | null;
  submissions?: HomeworkSubmission[];
  _count?: {
    submissions: number;
  };
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  content: string | null;
  attachments: string[];
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  };
}

export interface HomeworkFilters {
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  lessonId?: string;
  upcoming?: boolean;
  past?: boolean;
  limit?: number;
  offset?: number;
}

export interface HomeworkResponse {
  data: Homework[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SubmissionsResponse {
  homework: {
    id: string;
    title: string;
    dueDate: string;
  };
  submissions: HomeworkSubmission[];
  missingSubmissions: Array<{
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  }>;
  statistics: {
    totalStudents: number;
    submitted: number;
    missing: number;
    graded: number;
  };
}

export interface CreateHomeworkData {
  classId: string;
  subjectId: string;
  teacherId?: string;
  lessonId?: string | null;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  attachments?: string[];
  isPublished?: boolean;
}

export interface UpdateHomeworkData {
  title?: string;
  description?: string;
  dueDate?: string;
  attachments?: string[];
  isPublished?: boolean;
}

export interface SubmitHomeworkData {
  content?: string | null;
  attachments?: string[];
}

export interface GradeSubmissionData {
  studentId: string;
  grade?: number | null;
  feedback?: string | null;
}

// Query keys
export const homeworkKeys = {
  all: ['homework'] as const,
  lists: () => [...homeworkKeys.all, 'list'] as const,
  list: (filters: HomeworkFilters) => [...homeworkKeys.lists(), filters] as const,
  details: () => [...homeworkKeys.all, 'detail'] as const,
  detail: (id: string) => [...homeworkKeys.details(), id] as const,
  submissions: (homeworkId: string) =>
    [...homeworkKeys.all, 'submissions', homeworkId] as const,
};

// Helper to build query string
function buildQueryString(filters: HomeworkFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

// Fetch functions
async function fetchHomework(filters: HomeworkFilters = {}): Promise<HomeworkResponse> {
  const queryString = buildQueryString(filters);
  const url = `/api/homework${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento dei compiti');
  }
  return response.json();
}

async function fetchHomeworkDetail(id: string): Promise<Homework> {
  const response = await fetch(`/api/homework/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Compito non trovato');
  }
  return response.json();
}

async function fetchSubmissions(homeworkId: string): Promise<SubmissionsResponse> {
  const response = await fetch(`/api/homework/${homeworkId}/submissions`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento delle consegne');
  }
  return response.json();
}

async function createHomework(data: CreateHomeworkData): Promise<Homework> {
  const response = await fetch('/api/homework', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nella creazione del compito');
  }
  return response.json();
}

async function updateHomework({
  id,
  data,
}: {
  id: string;
  data: UpdateHomeworkData;
}): Promise<Homework> {
  const response = await fetch(`/api/homework/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'aggiornamento del compito');
  }
  return response.json();
}

async function deleteHomework(id: string): Promise<void> {
  const response = await fetch(`/api/homework/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'eliminazione del compito');
  }
}

async function submitHomework({
  homeworkId,
  data,
}: {
  homeworkId: string;
  data: SubmitHomeworkData;
}): Promise<HomeworkSubmission> {
  const response = await fetch(`/api/homework/${homeworkId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nella consegna del compito');
  }
  return response.json();
}

async function gradeSubmission({
  homeworkId,
  data,
}: {
  homeworkId: string;
  data: GradeSubmissionData;
}): Promise<HomeworkSubmission> {
  const response = await fetch(`/api/homework/${homeworkId}/submissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nella valutazione');
  }
  return response.json();
}

// Hooks
export function useHomework(filters: HomeworkFilters = {}) {
  return useQuery({
    queryKey: homeworkKeys.list(filters),
    queryFn: () => fetchHomework(filters),
  });
}

export function useHomeworkDetail(id: string) {
  return useQuery({
    queryKey: homeworkKeys.detail(id),
    queryFn: () => fetchHomeworkDetail(id),
    enabled: !!id,
  });
}

export function useHomeworkSubmissions(homeworkId: string) {
  return useQuery({
    queryKey: homeworkKeys.submissions(homeworkId),
    queryFn: () => fetchSubmissions(homeworkId),
    enabled: !!homeworkId,
  });
}

export function useCreateHomework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createHomework,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() });
    },
  });
}

export function useUpdateHomework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateHomework,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: homeworkKeys.detail(data.id) });
    },
  });
}

export function useDeleteHomework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteHomework,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homeworkKeys.all });
    },
  });
}

export function useSubmitHomework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitHomework,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: homeworkKeys.submissions(variables.homeworkId),
      });
      queryClient.invalidateQueries({
        queryKey: homeworkKeys.detail(variables.homeworkId),
      });
    },
  });
}

export function useGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: gradeSubmission,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: homeworkKeys.submissions(variables.homeworkId),
      });
    },
  });
}

// Utility functions
export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

export function getDueDateColor(dueDate: string): string {
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'red';
  if (diffDays === 0) return 'orange';
  if (diffDays <= 3) return 'yellow';
  return 'green';
}

export function formatDueDate(dueDate: string, locale = 'it-IT'): string {
  return new Date(dueDate).toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
