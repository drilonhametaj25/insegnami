import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'SYSTEM' | 'CLASS' | 'PAYMENT' | 'ATTENDANCE' | 'MESSAGE' | 'CALENDAR' | 'ANNOUNCEMENT' | 'REMINDER';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'UNREAD' | 'READ' | 'DISMISSED';
  actionUrl?: string;
  actionLabel?: string;
  readAt?: string;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationFilters {
  status?: 'UNREAD' | 'READ' | 'DISMISSED';
  type?: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

// Fetch notifications
export const useNotifications = (filters: NotificationFilters = {}) => {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async (): Promise<NotificationsResponse> => {
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.unreadOnly) params.append('unreadOnly', 'true');

      const response = await fetch(`/api/notifications?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nel caricamento notifiche');
      }
      
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute for real-time updates
  });
};

// Get unread count
export const useUnreadNotificationsCount = () => {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const response = await fetch('/api/notifications?unreadOnly=true&limit=1');
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento conteggio notifiche');
      }
      
      const data = await response.json();
      return data.pagination.total;
    },
    staleTime: 30000,
    refetchInterval: 30000, // More frequent for notification badge
  });
};

// Mark notification as read
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'markAsRead' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento notifica');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    },
  });
};

// Dismiss notification
export const useDismissNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'dismiss' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento notifica');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      notifications.show({
        title: 'Notifica rimossa',
        message: 'La notifica è stata rimossa',
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    },
  });
};

// Create notification (admin only)
export const useCreateNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: {
      title: string;
      content: string;
      type: string;
      priority?: string;
      userId?: string;
      actionUrl?: string;
      actionLabel?: string;
      sourceType?: string;
      sourceId?: string;
      scheduledFor?: string;
      expiresAt?: string;
      sendEmail?: boolean;
      sendPush?: boolean;
    }) => {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione notifica');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      notifications.show({
        title: 'Notifica creata',
        message: 'La notifica è stata creata con successo',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    },
  });
};

// Mark all as read
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento notifiche');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      notifications.show({
        title: 'Tutte le notifiche sono state lette',
        message: 'Tutte le notifiche sono state marcate come lette',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    },
  });
};
