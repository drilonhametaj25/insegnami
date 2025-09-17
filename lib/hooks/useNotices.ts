import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Notice {
  id: string;
  title: string;
  content: string;
  type: 'GENERAL' | 'URGENT' | 'EVENT' | 'ANNOUNCEMENT';
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  targetAudience: string[]; // ['STUDENTS', 'TEACHERS', 'PARENTS', 'ALL']
  attachments?: {
    id: string;
    filename: string;
    url: string;
  }[];
}

export interface NoticesResponse {
  notices: Notice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NoticeStats {
  totalNotices: number;
  publishedNotices: number;
  draftNotices: number;
  archivedNotices: number;
  urgentNotices: number;
  noticesThisMonth: number;
}

export interface CreateNoticeData {
  title: string;
  content: string;
  type?: 'GENERAL' | 'URGENT' | 'EVENT' | 'ANNOUNCEMENT';
  status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  publishedAt?: string;
  expiresAt?: string;
  targetAudience: string[];
}

// Query Keys
export const noticesKeys = {
  all: ['notices'] as const,
  lists: () => [...noticesKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...noticesKeys.lists(), filters] as const,
  details: () => [...noticesKeys.all, 'detail'] as const,
  detail: (id: string) => [...noticesKeys.details(), id] as const,
  stats: () => [...noticesKeys.all, 'stats'] as const,
  public: () => [...noticesKeys.all, 'public'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista degli avvisi con paginazione e filtri
 */
export function useNotices(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    type?: string;
    priority?: string;
    targetAudience?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: noticesKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<NoticesResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/notices?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notices: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere gli avvisi pubblici (per studenti/genitori)
 */
export function usePublicNotices(
  page = 1,
  limit = 10,
  userRole?: string
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: noticesKeys.public(),
    queryFn: async (): Promise<NoticesResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: 'PUBLISHED',
        public: 'true',
        ...(userRole && { targetAudience: userRole }),
      });

      const response = await fetch(`/api/notices?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch public notices: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes for public notices
  });
}

/**
 * Hook per ottenere un singolo avviso
 */
export function useNotice(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: noticesKeys.detail(id),
    queryFn: async (): Promise<Notice> => {
      const response = await fetch(`/api/notices/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notice: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere le statistiche degli avvisi
 */
export function useNoticeStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: noticesKeys.stats(),
    queryFn: async (): Promise<NoticeStats> => {
      const response = await fetch('/api/notices/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notice stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Hook per creare un nuovo avviso
 */
export function useCreateNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoticeData): Promise<Notice> => {
      const response = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create notice');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notices list
      queryClient.invalidateQueries({ queryKey: noticesKeys.lists() });
      // Invalidate public notices if published
      queryClient.invalidateQueries({ queryKey: noticesKeys.public() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: noticesKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un avviso esistente
 */
export function useUpdateNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateNoticeData> }): Promise<Notice> => {
      const response = await fetch(`/api/notices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update notice');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific notice in cache
      queryClient.setQueryData(noticesKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: noticesKeys.lists() });
      // Invalidate public notices
      queryClient.invalidateQueries({ queryKey: noticesKeys.public() });
    },
  });
}

/**
 * Hook per eliminare un avviso
 */
export function useDeleteNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/notices/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete notice');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: noticesKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: noticesKeys.lists() });
      // Invalidate public notices
      queryClient.invalidateQueries({ queryKey: noticesKeys.public() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: noticesKeys.stats() });
    },
  });
}

/**
 * Hook per pubblicare un avviso
 */
export function usePublishNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<Notice> => {
      const response = await fetch(`/api/notices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PUBLISHED',
          publishedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish notice');
      }

      return response.json();
    },
    onSuccess: (data, id) => {
      // Update the specific notice in cache
      queryClient.setQueryData(noticesKeys.detail(id), data);
      // Invalidate lists and public notices
      queryClient.invalidateQueries({ queryKey: noticesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noticesKeys.public() });
      queryClient.invalidateQueries({ queryKey: noticesKeys.stats() });
    },
  });
}

/**
 * Hook per archiviare un avviso
 */
export function useArchiveNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<Notice> => {
      const response = await fetch(`/api/notices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ARCHIVED',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive notice');
      }

      return response.json();
    },
    onSuccess: (data, id) => {
      // Update the specific notice in cache
      queryClient.setQueryData(noticesKeys.detail(id), data);
      // Invalidate lists and public notices
      queryClient.invalidateQueries({ queryKey: noticesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noticesKeys.public() });
      queryClient.invalidateQueries({ queryKey: noticesKeys.stats() });
    },
  });
}
