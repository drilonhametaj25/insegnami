import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface OverviewStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalLessons: number;
  activeStudents: number;
  overduePayments: number;
  totalRevenue: number;
  attendanceRate: number;
  paymentRate: number;
}

export interface AttendanceStats {
  byStatus: Array<{
    status: string;
    _count: { status: number };
  }>;
  daily: Record<string, number>;
  totalRecords: number;
}

export interface FinancialStats {
  byStatus: Array<{
    status: string;
    _count: { status: number };
    _sum: { amount: number | null };
  }>;
  dailyRevenue: Record<string, number>;
  totalRevenue: number;
}

export interface TrendStats {
  enrollments: Record<string, number>;
  lessons: Record<string, number>;
}

export interface Report {
  id: string;
  tenantId: string;
  title: string;
  type: 'ATTENDANCE' | 'FINANCIAL' | 'PROGRESS' | 'OVERVIEW' | 'CLASS_ANALYTICS' | 'TEACHER_PERFORMANCE';
  period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
  startDate: string;
  endDate: string;
  data: any;
  filters: any;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface DashboardWidget {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  config: any;
  position: any;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

// Analytics Hooks
export function useOverviewStats(period: string = '30') {
  return useQuery<OverviewStats>({
    queryKey: ['analytics', 'overview', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?type=overview&period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch overview stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAttendanceStats(period: string = '30') {
  return useQuery<AttendanceStats>({
    queryKey: ['analytics', 'attendance', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?type=attendance&period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFinancialStats(period: string = '30') {
  return useQuery<FinancialStats>({
    queryKey: ['analytics', 'financial', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?type=financial&period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch financial stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendStats(period: string = '30') {
  return useQuery<TrendStats>({
    queryKey: ['analytics', 'trends', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?type=trends&period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trend stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Reports Hooks
export function useReports() {
  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      const response = await fetch('/api/reports');
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      return response.json();
    },
  });
}

export function useReport(id: string) {
  return useQuery<Report>({
    queryKey: ['reports', id],
    queryFn: async () => {
      const response = await fetch(`/api/reports/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportData: Partial<Report>) => {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error('Failed to create report');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete report');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

// Dashboard Widgets Hooks
export function useDashboardWidgets() {
  return useQuery<DashboardWidget[]>({
    queryKey: ['dashboard-widgets'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/widgets');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard widgets');
      }
      return response.json();
    },
  });
}

export function useUpdateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...widgetData }: Partial<DashboardWidget> & { id: string }) => {
      const response = await fetch(`/api/dashboard/widgets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(widgetData),
      });

      if (!response.ok) {
        throw new Error('Failed to update widget');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    },
  });
}

export function useCreateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgetData: Partial<DashboardWidget>) => {
      const response = await fetch('/api/dashboard/widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(widgetData),
      });

      if (!response.ok) {
        throw new Error('Failed to create widget');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    },
  });
}

// Utility function to export data
export async function exportAnalyticsData(type: string, format: 'csv' | 'xlsx' | 'pdf', period: string) {
  const response = await fetch(`/api/analytics/export?type=${type}&format=${format}&period=${period}`);
  
  if (!response.ok) {
    throw new Error('Failed to export data');
  }

  // Handle file download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `${type}-analytics-${period}days.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
