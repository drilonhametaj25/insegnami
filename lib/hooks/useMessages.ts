import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Message {
  id: string;
  title: string;
  content: string;
  type: 'DIRECT' | 'GROUP' | 'BROADCAST' | 'AUTOMATED';
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  scheduledAt?: Date;
  sentAt?: Date;
  sendEmail: boolean;
  sendSms: boolean;
  sendPush: boolean;
  emailTemplate?: string;
  emailSubject?: string;
  priority: number;
  isUrgent: boolean;
  requiresResponse: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  recipients?: MessageRecipient[];
  _count?: {
    recipients: number;
  };
}

export interface MessageRecipient {
  id: string;
  userId: string;
  emailStatus: string;
  smsStatus: string;
  pushStatus: string;
  emailDeliveredAt?: Date;
  emailReadAt?: Date;
  smsDeliveredAt?: Date;
  pushDeliveredAt?: Date;
  pushReadAt?: Date;
  hasResponded: boolean;
  respondedAt?: Date;
  response?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  content: string;
  type: string;
  variables?: string;
  usageCount: number;
  lastUsedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CommunicationGroup {
  id: string;
  name: string;
  description?: string;
  type: string;
  autoSync: boolean;
  syncRules?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
  memberships?: {
    id: string;
    userId: string;
    isActive: boolean;
    canSendMessages: boolean;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }[];
  _count?: {
    memberships: number;
  };
}

export interface CreateMessageData {
  title: string;
  content: string;
  type?: string;
  recipientIds: string[];
  groupIds?: string[];
  scheduledAt?: Date;
  sendEmail?: boolean;
  sendSms?: boolean;
  sendPush?: boolean;
  emailTemplate?: string;
  emailSubject?: string;
  priority?: number;
  isUrgent?: boolean;
  requiresResponse?: boolean;
}

// Query keys
export const messagesKeys = {
  all: ['messages'] as const,
  lists: () => [...messagesKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...messagesKeys.lists(), { filters }] as const,
  details: () => [...messagesKeys.all, 'detail'] as const,
  detail: (id: string) => [...messagesKeys.details(), id] as const,
  templates: () => [...messagesKeys.all, 'templates'] as const,
  groups: () => [...messagesKeys.all, 'groups'] as const,
  stats: () => [...messagesKeys.all, 'stats'] as const,
};

/**
 * Hook per ottenere i messaggi con paginazione e filtri
 */
export function useMessages(params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  urgent?: boolean;
  sent?: boolean;
}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: messagesKeys.list(params || {}),
    queryFn: async (): Promise<{
      messages: Message[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.status) searchParams.append('status', params.status);
      if (params?.type) searchParams.append('type', params.type);
      if (params?.urgent !== undefined) searchParams.append('urgent', params.urgent.toString());
      if (params?.sent !== undefined) searchParams.append('sent', params.sent.toString());

      const response = await fetch(`/api/messages?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere un messaggio singolo
 */
export function useMessageById(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: messagesKeys.detail(id),
    queryFn: async (): Promise<Message> => {
      const response = await fetch(`/api/messages/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch message: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere i template di messaggi
 */
export function useMessageTemplates() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: messagesKeys.templates(),
    queryFn: async (): Promise<MessageTemplate[]> => {
      const response = await fetch('/api/messages/templates');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere i gruppi di comunicazione
 */
export function useCommunicationGroups() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: messagesKeys.groups(),
    queryFn: async (): Promise<CommunicationGroup[]> => {
      const response = await fetch('/api/messages/groups');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.statusText}`);
      }

      const data = await response.json();
      // Handle both direct array response and object with groups property
      return Array.isArray(data) ? data : (data.groups || []);
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per creare un nuovo messaggio
 */
export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMessageData): Promise<Message> => {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create message');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate messages list
      queryClient.invalidateQueries({ queryKey: messagesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un messaggio
 */
export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateMessageData>): Promise<Message> => {
      const response = await fetch(`/api/messages/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Update the specific message in cache
      queryClient.setQueryData(messagesKeys.detail(data.id), data);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: messagesKeys.lists() });
    },
  });
}

/**
 * Hook per eliminare un messaggio
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/messages/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete message');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: messagesKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: messagesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.stats() });
    },
  });
}

/**
 * Hook per inviare un messaggio
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<Message> => {
      const response = await fetch(`/api/messages/${id}/send`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Update the specific message in cache
      queryClient.setQueryData(messagesKeys.detail(data.id), data);
      // Invalidate lists and stats
      queryClient.invalidateQueries({ queryKey: messagesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.stats() });
    },
  });
}

/**
 * Hook per creare un template di messaggio
 */
export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      subject: string;
      content: string;
      type?: string;
      variables?: string[];
    }): Promise<MessageTemplate> => {
      const response = await fetch('/api/messages/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.templates() });
    },
  });
}

/**
 * Hook per creare un gruppo di comunicazione
 */
export function useCreateCommunicationGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      type?: string;
      memberIds: string[];
      autoSync?: boolean;
      syncRules?: any;
    }): Promise<CommunicationGroup> => {
      const response = await fetch('/api/messages/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create group');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.groups() });
    },
  });
}
