import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Types
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: Date;
  paidDate?: Date;
  method?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  class?: {
    id: string;
    name: string;
    level: string;
  };
}

export interface PaymentsResponse {
  payments: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentStats {
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  overduePayments: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  monthlyRevenue: {
    month: string;
    amount: number;
  }[];
}

export interface CreatePaymentData {
  studentId: string;
  classId?: string;
  amount: number;
  currency?: string;
  description?: string;
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  paidDate?: string;
  method?: string;
  notes?: string;
}

// Query Keys
export const paymentsKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...paymentsKeys.lists(), filters] as const,
  details: () => [...paymentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentsKeys.details(), id] as const,
  stats: () => [...paymentsKeys.all, 'stats'] as const,
};

// Hooks

/**
 * Hook per ottenere la lista dei pagamenti con paginazione e filtri
 */
export function usePayments(
  page = 1,
  limit = 20,
  filters: {
    search?: string;
    status?: string;
    studentId?: string;
    classId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: paymentsKeys.list({ page, limit, ...filters }),
    queryFn: async (): Promise<PaymentsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/payments?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch payments: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
  });
}

/**
 * Hook per ottenere un singolo pagamento
 */
export function usePayment(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: paymentsKeys.detail(id),
    queryFn: async (): Promise<Payment> => {
      const response = await fetch(`/api/payments/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch payment: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user && !!id,
  });
}

/**
 * Hook per ottenere le statistiche dei pagamenti
 */
export function usePaymentStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: paymentsKeys.stats(),
    queryFn: async (): Promise<PaymentStats> => {
      const response = await fetch('/api/payments/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch payment stats: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!session?.user,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Hook per creare un nuovo pagamento
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentData): Promise<Payment> => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch payments list
      queryClient.invalidateQueries({ queryKey: paymentsKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: paymentsKeys.stats() });
    },
  });
}

/**
 * Hook per aggiornare un pagamento esistente
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePaymentData> }): Promise<Payment> => {
      const response = await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update payment');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific payment in cache
      queryClient.setQueryData(paymentsKeys.detail(id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: paymentsKeys.lists() });
      // Invalidate stats if status changed
      queryClient.invalidateQueries({ queryKey: paymentsKeys.stats() });
    },
  });
}

/**
 * Hook per eliminare un pagamento
 */
export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/payments/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete payment');
      }
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: paymentsKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: paymentsKeys.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: paymentsKeys.stats() });
    },
  });
}

/**
 * Hook per segnare un pagamento come pagato
 */
export function useMarkPaymentAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      paidDate, 
      method 
    }: { 
      id: string; 
      paidDate?: string; 
      method?: string; 
    }): Promise<Payment> => {
      const response = await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PAID',
          paidDate: paidDate || new Date().toISOString(),
          method,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark payment as paid');
      }

      return response.json();
    },
    onSuccess: (data, { id }) => {
      // Update the specific payment in cache
      queryClient.setQueryData(paymentsKeys.detail(id), data);
      // Invalidate lists and stats
      queryClient.invalidateQueries({ queryKey: paymentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentsKeys.stats() });
    },
  });
}
