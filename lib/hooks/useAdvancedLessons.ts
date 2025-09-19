import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

export interface LessonEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  room?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isRecurring: boolean;
  recurrenceRule?: string;
  parentLessonId?: string;
  class: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
    };
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
  attendance?: {
    present: number;
    total: number;
  };
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflicts: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    room?: string;
  }>;
}

export interface CreateLessonData {
  title: string;
  description?: string;
  classId: string;
  teacherId: string;
  startTime: string;
  endTime: string;
  room?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
}

export interface UpdateLessonData {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  status?: string;
}

export const useLessons = (filters: {
  startDate?: string;
  endDate?: string;
  classId?: string;
  teacherId?: string;
  status?: string;
} = {}) => {
  return useQuery({
    queryKey: ['lessons', filters],
    queryFn: async (): Promise<LessonEvent[]> => {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.classId) params.append('classId', filters.classId);
      if (filters.teacherId) params.append('teacherId', filters.teacherId);
      if (filters.status) params.append('status', filters.status);
      
      // Set high limit for calendar view to get all lessons in range
      params.append('limit', '1000');

      const response = await fetch(`/api/lessons?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nel caricamento lezioni');
      }
      
      const result = await response.json();
      return result.lessons || []; // Extract lessons array from response
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
};

// Create new lesson
export const useCreateLesson = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonData: CreateLessonData): Promise<LessonEvent> => {
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lessonData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione lezione');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      notifications.show({
        title: 'Lezione creata',
        message: 'La lezione è stata creata con successo',
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

// Update lesson (including drag & drop moves)
export const useUpdateLesson = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: UpdateLessonData 
    }): Promise<LessonEvent> => {
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento lezione');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      notifications.show({
        title: 'Lezione aggiornata',
        message: 'La lezione è stata aggiornata con successo',
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

// Delete lesson
export const useDeleteLesson = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'eliminazione lezione');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      notifications.show({
        title: 'Lezione eliminata',
        message: 'La lezione è stata eliminata con successo',
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

// Check for scheduling conflicts
export const useCheckConflicts = () => {
  return useMutation({
    mutationFn: async ({
      startTime,
      endTime,
      teacherId,
      room,
      excludeLessonId,
    }: {
      startTime: string;
      endTime: string;
      teacherId?: string;
      room?: string;
      excludeLessonId?: string;
    }): Promise<ConflictInfo> => {
      const params = new URLSearchParams({
        startTime,
        endTime,
        ...(teacherId && { teacherId }),
        ...(room && { room }),
        ...(excludeLessonId && { excludeLessonId }),
      });

      const response = await fetch(`/api/lessons/check-conflicts?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nel controllo conflitti');
      }
      
      return response.json();
    },
  });
};

// Bulk operations for lessons
export const useBulkUpdateLessons = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lessonIds,
      updates,
    }: {
      lessonIds: string[];
      updates: UpdateLessonData;
    }): Promise<void> => {
      const response = await fetch('/api/lessons/bulk', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonIds,
          updates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'aggiornamento multiplo');
      }
    },
    onSuccess: (_, { lessonIds }) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      notifications.show({
        title: 'Lezioni aggiornate',
        message: `${lessonIds.length} lezioni aggiornate con successo`,
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

// Create recurring lessons series
export const useCreateRecurringLessons = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lessonData,
      recurrence,
    }: {
      lessonData: CreateLessonData;
      recurrence: {
        frequency: 'weekly' | 'monthly';
        interval: number; // ogni X settimane/mesi
        endDate?: string;
        occurrences?: number;
        weekdays?: number[]; // 0 = domenica, 1 = lunedì, etc.
      };
    }): Promise<LessonEvent[]> => {
      const response = await fetch('/api/lessons/recurring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...lessonData,
          recurrence,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione serie ricorrente');
      }

      return response.json();
    },
    onSuccess: (lessons) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      notifications.show({
        title: 'Serie ricorrente creata',
        message: `${lessons.length} lezioni create con successo`,
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
