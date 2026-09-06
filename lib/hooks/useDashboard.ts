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
    course: any;
    teacher: {
      id: string;
      name: string;
      email: string;
    };
    enrolledAt: string;
    progress: number;
    totalLessons: number;
    attendedLessons: number;
  }>;
  homework: Array<{
    id: string;
    title: string;
    description?: string;
    course: string;
    subject?: string;
    className?: string;
    dueDate: string;
    assignedDate: string;
    status: 'pending' | 'submitted' | 'graded';
    grade?: number;
    feedback?: string;
    submittedAt?: string;
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
    paidDate?: string | null;
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
  hoursPackages: Array<{
    id: string;
    course?: { id: string; name: string; level?: string | null } | null;
    totalHours: number;
    usedHours: number;
    remainingHours: number;
    usedPercentage: number;
    isLow: boolean;
    expiryDate?: string | null;
    isActive: boolean;
    purchaseDate: string;
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
      pendingPayments: number;
    };
    classes: Array<{
      id: string;
      name: string;
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
    paidDate?: string | null;
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

// Teacher dashboard data interface
export interface TeacherDashboardLesson {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  room?: string | null;
  class: { id: string; name: string } | null;
  _count?: { attendance: number };
}

export interface TeacherDashboardData {
  todayLessons: TeacherDashboardLesson[];
  pendingAttendance: TeacherDashboardLesson[];
  upcomingHomework: Array<{
    id: string;
    title: string;
    dueDate: string;
    class: { id: string; name: string } | null;
    subject?: { id: string; name: string } | null;
  }>;
  weekLessonsCount: number;
}

// Hook per la dashboard docente
export function useTeacherDashboard() {
  return useQuery<{ success: boolean; data: TeacherDashboardData }>({
    queryKey: ['dashboard', 'teacher'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/teacher');
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Errore nel caricamento della dashboard docente');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
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
