import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MeetingStatus } from '@prisma/client';

// Types
export interface ParentMeeting {
  id: string;
  tenantId: string;
  teacherId: string;
  parentId: string;
  studentId: string;
  date: string;
  duration: number;
  room?: string | null;
  status: MeetingStatus;
  teacherNotes?: string | null;
  parentNotes?: string | null;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
    parentUserId?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ParentMeetingFilters {
  teacherId?: string;
  studentId?: string;
  status?: MeetingStatus | string;
  startDate?: string;
  endDate?: string;
  upcoming?: boolean;
  limit?: number;
  offset?: number;
}

export interface ParentMeetingsResponse {
  meetings: ParentMeeting[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ParentMeetingStats {
  total: number;
  requested: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  recentMeetings?: ParentMeeting[];
  byTeacher?: { teacherId: string; teacherName: string; count: number }[];
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  meetingId?: string;
}

export interface TeacherAvailability {
  teacher: {
    id: string;
    name: string;
  };
  availability: {
    startHour: number;
    endHour: number;
    slotDuration: number;
    availableDays: number[];
  };
  slots: Record<string, TimeSlot[]>;
}

export interface CreateParentMeetingInput {
  studentId: string;
  teacherId?: string;
  date: string;
  duration?: number;
  room?: string;
  parentNotes?: string;
  teacherNotes?: string;
}

export interface UpdateParentMeetingInput {
  date?: string;
  duration?: number;
  room?: string | null;
  parentNotes?: string;
  teacherNotes?: string;
}

export interface UpdateMeetingStatusInput {
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  reason?: string;
}

// Query keys
export const parentMeetingKeys = {
  all: ['parentMeetings'] as const,
  lists: () => [...parentMeetingKeys.all, 'list'] as const,
  list: (filters: ParentMeetingFilters) =>
    [...parentMeetingKeys.lists(), filters] as const,
  details: () => [...parentMeetingKeys.all, 'detail'] as const,
  detail: (id: string) => [...parentMeetingKeys.details(), id] as const,
  availability: (teacherId: string, date?: string) =>
    [...parentMeetingKeys.all, 'availability', teacherId, date] as const,
  stats: () => [...parentMeetingKeys.all, 'stats'] as const,
};

// API functions
async function fetchParentMeetings(
  filters: ParentMeetingFilters
): Promise<ParentMeetingsResponse> {
  const params = new URLSearchParams();
  if (filters.teacherId) params.set('teacherId', filters.teacherId);
  if (filters.studentId) params.set('studentId', filters.studentId);
  if (filters.status) params.set('status', filters.status);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.upcoming) params.set('upcoming', 'true');
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.offset) params.set('offset', filters.offset.toString());

  const response = await fetch(`/api/parent-meetings?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento dei colloqui');
  }
  return response.json();
}

async function fetchParentMeeting(id: string): Promise<ParentMeeting> {
  const response = await fetch(`/api/parent-meetings/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento del colloquio');
  }
  return response.json();
}

async function fetchTeacherAvailability(
  teacherId: string,
  date?: string
): Promise<TeacherAvailability> {
  const params = new URLSearchParams({ teacherId });
  if (date) params.set('date', date);

  const response = await fetch(
    `/api/parent-meetings/teacher/availability?${params.toString()}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento della disponibilità');
  }
  return response.json();
}

async function fetchParentMeetingStats(): Promise<ParentMeetingStats> {
  const response = await fetch('/api/parent-meetings/stats');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel caricamento delle statistiche');
  }
  return response.json();
}

async function createParentMeeting(
  data: CreateParentMeetingInput
): Promise<ParentMeeting> {
  const response = await fetch('/api/parent-meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nella creazione del colloquio');
  }
  return response.json();
}

async function updateParentMeeting({
  id,
  data,
}: {
  id: string;
  data: UpdateParentMeetingInput;
}): Promise<ParentMeeting> {
  const response = await fetch(`/api/parent-meetings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'aggiornamento del colloquio');
  }
  return response.json();
}

async function updateMeetingStatus({
  id,
  data,
}: {
  id: string;
  data: UpdateMeetingStatusInput;
}): Promise<{ success: boolean; previousStatus: string; newStatus: string; meeting: ParentMeeting }> {
  const response = await fetch(`/api/parent-meetings/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel cambio di stato');
  }
  return response.json();
}

async function deleteParentMeeting(id: string): Promise<void> {
  const response = await fetch(`/api/parent-meetings/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'eliminazione del colloquio');
  }
}

// Query Hooks
export function useParentMeetings(filters: ParentMeetingFilters = {}) {
  return useQuery({
    queryKey: parentMeetingKeys.list(filters),
    queryFn: () => fetchParentMeetings(filters),
  });
}

export function useParentMeeting(id: string) {
  return useQuery({
    queryKey: parentMeetingKeys.detail(id),
    queryFn: () => fetchParentMeeting(id),
    enabled: !!id,
  });
}

export function useTeacherAvailability(teacherId: string, date?: string) {
  return useQuery({
    queryKey: parentMeetingKeys.availability(teacherId, date),
    queryFn: () => fetchTeacherAvailability(teacherId, date),
    enabled: !!teacherId,
  });
}

export function useParentMeetingStats() {
  return useQuery({
    queryKey: parentMeetingKeys.stats(),
    queryFn: fetchParentMeetingStats,
  });
}

// Mutation Hooks
export function useCreateParentMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createParentMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.stats() });
    },
  });
}

export function useUpdateParentMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateParentMeeting,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: parentMeetingKeys.detail(data.id),
      });
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.stats() });
    },
  });
}

export function useUpdateMeetingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMeetingStatus,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: parentMeetingKeys.detail(data.meeting.id),
      });
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.stats() });
    },
  });
}

export function useDeleteParentMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteParentMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: parentMeetingKeys.stats() });
    },
  });
}

// Helper functions
export function getStatusColor(status: MeetingStatus): string {
  switch (status) {
    case 'REQUESTED':
      return 'yellow';
    case 'CONFIRMED':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'CANCELLED':
      return 'gray';
    default:
      return 'gray';
  }
}

export function getStatusIcon(status: MeetingStatus): string {
  switch (status) {
    case 'REQUESTED':
      return 'IconClock';
    case 'CONFIRMED':
      return 'IconCheck';
    case 'COMPLETED':
      return 'IconCircleCheck';
    case 'CANCELLED':
      return 'IconX';
    default:
      return 'IconQuestionMark';
  }
}

export function formatMeetingDate(dateStr: string, locale: string = 'it-IT'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMeetingTime(dateStr: string, locale: string = 'it-IT'): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMeetingDateTime(dateStr: string, locale: string = 'it-IT'): string {
  return `${formatMeetingDate(dateStr, locale)}, ${formatMeetingTime(dateStr, locale)}`;
}

export function isMeetingInPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

export function canConfirmMeeting(meeting: ParentMeeting): boolean {
  return meeting.status === 'REQUESTED' && !isMeetingInPast(meeting.date);
}

export function canCancelMeeting(meeting: ParentMeeting): boolean {
  return ['REQUESTED', 'CONFIRMED'].includes(meeting.status);
}

export function canCompleteMeeting(meeting: ParentMeeting): boolean {
  return meeting.status === 'CONFIRMED';
}

export function canEditMeeting(meeting: ParentMeeting): boolean {
  return ['REQUESTED', 'CONFIRMED'].includes(meeting.status) && !isMeetingInPast(meeting.date);
}

export function canDeleteMeeting(meeting: ParentMeeting): boolean {
  return ['REQUESTED', 'CANCELLED'].includes(meeting.status);
}
