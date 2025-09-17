import { useQuery } from '@tanstack/react-query';

// Student dashboard data interface
interface StudentDashboardData {
  student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth: string;
    status: string;
    enrollmentDate: string;
    user?: any;
    parentUser?: any;
  };
  stats: {
    activeCourses: number;
    attendanceRate: number;
    upcomingLessons: number;
    totalLessons: number;
    pendingPayments: number;
  };
  classes: Array<{
    id: string;
    name: string;
    description?: string;
    schedule?: any;
    course: any;
    teacher: {
      id: string;
      name: string;
      email: string;
    };
    enrolledAt: string;
  }>;
  upcomingLessons: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    status: string;
    teacher: {
      name: string;
      email: string;
    };
    class: {
      name: string;
      course?: string;
    };
    room?: string;
    materials?: string;
  }>;
  recentAttendance: Array<{
    id: string;
    status: string;
    recordedAt: string;
    notes?: string;
    lesson: {
      id: string;
      title: string;
      date: string;
      teacher: string;
      course?: string;
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    description?: string;
    dueDate: string;
    status: string;
    paidAt?: string;
    type: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    content: string;
    publishAt: string;
    isUrgent: boolean;
    isPinned: boolean;
    targetRoles: string[];
  }>;
}

// Parent dashboard data interface
interface ParentDashboardData {
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  stats: {
    enrolledChildren: number;
    totalActiveCourses: number;
    averageAttendanceRate: number;
    totalUpcomingLessons: number;
    totalPendingPayments: number;
  };
  children: Array<{
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth: string;
    status: string;
    enrollmentDate: string;
    user?: any;
    stats: {
      activeCourses: number;
      attendanceRate: number;
      totalLessons: number;
    };
    classes: Array<{
      id: string;
      name: string;
      description?: string;
      schedule?: any;
      course: any;
      teacher: {
        id: string;
        name: string;
        email: string;
      };
      enrolledAt: string;
    }>;
    nextLesson?: {
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      teacher: string;
      course?: string;
    } | null;
  }>;
  upcomingLessons: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    status: string;
    teacher: {
      name: string;
      email: string;
    };
    class: {
      name: string;
      course?: string;
    };
    room?: string;
    materials?: string;
    enrolledChildren: Array<{
      id: string;
      name: string;
    }>;
  }>;
  attendanceRecords: Array<{
    id: string;
    status: string;
    recordedAt: string;
    notes?: string;
    child: {
      id: string;
      name: string;
    };
    lesson: {
      id: string;
      title: string;
      date: string;
      teacher: string;
      course?: string;
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    description?: string;
    dueDate: string;
    status: string;
    paidAt?: string;
    type: string;
    child: {
      id: string;
      name: string;
    };
  }>;
  notices: Array<{
    id: string;
    title: string;
    content: string;
    publishAt: string;
    isUrgent: boolean;
    isPinned: boolean;
    targetRoles: string[];
  }>;
}

// Hook for student dashboard
export function useStudentDashboard() {
  return useQuery<{ success: boolean; data: StudentDashboardData }>({
    queryKey: ['dashboard', 'student'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/student');
      if (!response.ok) {
        throw new Error('Failed to fetch student dashboard data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook for parent dashboard
export function useParentDashboard() {
  return useQuery<{ success: boolean; data: ParentDashboardData }>({
    queryKey: ['dashboard', 'parent'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/parent');
      if (!response.ok) {
        throw new Error('Failed to fetch parent dashboard data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
