'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReportCardStatus } from '@prisma/client';

// Types
export interface ReportCardEntry {
  id: string;
  reportCardId: string;
  subjectId: string;
  finalGrade: number;
  finalGradeText: string | null;
  averageOral: number | null;
  averageWritten: number | null;
  averagePractical: number | null;
  overallAverage: number | null;
  teacherComment: string | null;
  absenceCount: number;
  subject?: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  };
}

export interface ReportCard {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  periodId: string;
  status: ReportCardStatus;
  overallComment: string | null;
  behaviorGrade: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  pdfUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
  };
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    dateOfBirth?: string;
  };
  class?: {
    id: string;
    name: string;
    code: string;
    course?: {
      id: string;
      name: string;
    };
  };
  period?: {
    id: string;
    name: string;
    type: string;
    startDate?: string;
    endDate?: string;
    academicYear?: {
      id: string;
      name: string;
    };
  };
  entries?: ReportCardEntry[];
  _count?: {
    entries: number;
  };
}

export interface ReportCardFilters {
  classId?: string;
  periodId?: string;
  studentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ReportCardsResponse {
  data: ReportCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    draft: number;
    inReview: number;
    approved: number;
    published: number;
    archived: number;
  };
}

export interface GenerateReportCardsInput {
  classId: string;
  periodId: string;
}

export interface GenerateReportCardsResponse {
  success: boolean;
  summary: {
    total: number;
    created: number;
    skipped: number;
    errors: number;
  };
  details: Array<{
    studentId: string;
    studentName: string;
    status: string;
    error?: string;
  }>;
}

export interface ApproveReportCardInput {
  id: string;
  action: 'submit' | 'approve' | 'reject' | 'publish' | 'archive';
  comment?: string;
}

export interface UpdateReportCardInput {
  id: string;
  data: {
    overallComment?: string;
    behaviorGrade?: string;
  };
}

export interface UpdateEntriesInput {
  reportCardId: string;
  entries: Array<{
    id?: string;
    subjectId: string;
    finalGrade: number;
    finalGradeText?: string;
    teacherComment?: string;
  }>;
}

// Query keys
export const reportCardKeys = {
  all: ['reportCards'] as const,
  lists: () => [...reportCardKeys.all, 'list'] as const,
  list: (filters: ReportCardFilters) => [...reportCardKeys.lists(), filters] as const,
  details: () => [...reportCardKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportCardKeys.details(), id] as const,
  entries: (id: string) => [...reportCardKeys.all, 'entries', id] as const,
};

// Fetch functions
async function fetchReportCards(filters: ReportCardFilters): Promise<ReportCardsResponse> {
  const params = new URLSearchParams();
  if (filters.classId) params.append('classId', filters.classId);
  if (filters.periodId) params.append('periodId', filters.periodId);
  if (filters.studentId) params.append('studentId', filters.studentId);
  if (filters.status) params.append('status', filters.status);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(`/api/report-cards?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch report cards');
  }
  return response.json();
}

async function fetchReportCard(id: string): Promise<ReportCard> {
  const response = await fetch(`/api/report-cards/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch report card');
  }
  return response.json();
}

async function fetchReportCardEntries(id: string): Promise<{ entries: ReportCardEntry[] }> {
  const response = await fetch(`/api/report-cards/${id}/entries`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch entries');
  }
  return response.json();
}

async function createReportCard(data: {
  studentId: string;
  classId: string;
  periodId: string;
}): Promise<ReportCard> {
  const response = await fetch('/api/report-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create report card');
  }
  return response.json();
}

async function updateReportCard({ id, data }: UpdateReportCardInput): Promise<ReportCard> {
  const response = await fetch(`/api/report-cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update report card');
  }
  return response.json();
}

async function deleteReportCard(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/report-cards/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete report card');
  }
  return response.json();
}

async function generateReportCards(
  data: GenerateReportCardsInput
): Promise<GenerateReportCardsResponse> {
  const response = await fetch('/api/report-cards/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate report cards');
  }
  return response.json();
}

async function approveReportCard({
  id,
  action,
  comment,
}: ApproveReportCardInput): Promise<{
  success: boolean;
  action: string;
  previousStatus: string;
  newStatus: string;
  reportCard: ReportCard;
}> {
  const response = await fetch(`/api/report-cards/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, comment }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update status');
  }
  return response.json();
}

async function updateReportCardEntries({
  reportCardId,
  entries,
}: UpdateEntriesInput): Promise<{ entries: ReportCardEntry[]; updated: number }> {
  const response = await fetch(`/api/report-cards/${reportCardId}/entries`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update entries');
  }
  return response.json();
}

// Hooks
export function useReportCards(filters: ReportCardFilters = {}) {
  return useQuery({
    queryKey: reportCardKeys.list(filters),
    queryFn: () => fetchReportCards(filters),
  });
}

export function useReportCard(id: string) {
  return useQuery({
    queryKey: reportCardKeys.detail(id),
    queryFn: () => fetchReportCard(id),
    enabled: !!id,
  });
}

export function useReportCardEntries(reportCardId: string) {
  return useQuery({
    queryKey: reportCardKeys.entries(reportCardId),
    queryFn: () => fetchReportCardEntries(reportCardId),
    enabled: !!reportCardId,
  });
}

export function useCreateReportCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReportCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportCardKeys.lists() });
    },
  });
}

export function useUpdateReportCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateReportCard,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: reportCardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reportCardKeys.detail(data.id) });
    },
  });
}

export function useDeleteReportCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReportCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportCardKeys.lists() });
    },
  });
}

export function useGenerateReportCards() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateReportCards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportCardKeys.lists() });
    },
  });
}

export function useApproveReportCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveReportCard,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: reportCardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reportCardKeys.detail(data.reportCard.id) });
    },
  });
}

export function useUpdateReportCardEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateReportCardEntries,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: reportCardKeys.entries(variables.reportCardId),
      });
      queryClient.invalidateQueries({
        queryKey: reportCardKeys.detail(variables.reportCardId),
      });
    },
  });
}

// Helper function to download PDF
export async function downloadReportCardPDF(id: string, filename?: string): Promise<void> {
  const response = await fetch(`/api/report-cards/${id}/pdf`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate PDF');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `pagella_${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Helper function to get status color
export function getStatusColor(status: ReportCardStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'gray';
    case 'IN_REVIEW':
      return 'yellow';
    case 'APPROVED':
      return 'blue';
    case 'PUBLISHED':
      return 'green';
    case 'ARCHIVED':
      return 'dark';
    default:
      return 'gray';
  }
}

// Helper function to get grade color
export function getGradeColor(grade: number): string {
  if (grade < 6) return 'red';
  if (grade === 6) return 'yellow';
  return 'green';
}
