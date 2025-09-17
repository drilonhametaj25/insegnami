import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { NextIntlClientProvider } from 'next-intl'

// Mock messages for testing
const messages = {
  Dashboard: {
    welcome: 'Welcome',
    students: 'Students',
    teachers: 'Teachers',
    classes: 'Classes',
  },
  Students: {
    title: 'Students',
    add: 'Add Student',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
  },
  Analytics: {
    title: 'Analytics & Reports',
    totalStudents: 'Total Students',
    totalTeachers: 'Total Teachers',
    totalClasses: 'Total Classes',
    totalLessons: 'Total Lessons',
  }
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  locale?: string
}

const AllTheProviders = ({ 
  children, 
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
  locale = 'it' 
}: { 
  children: React.ReactNode
  queryClient?: QueryClient
  locale?: string
}) => {
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MantineProvider>
    </NextIntlClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { queryClient, locale, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: (props) => AllTheProviders({ 
      ...props, 
      queryClient, 
      locale 
    }),
    ...renderOptions,
  })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Helper functions
export const createMockQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const mockUser = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'ADMIN' as const,
}

export const mockStudents = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    status: 'ACTIVE',
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    status: 'ACTIVE',
  },
]

export const mockAnalytics = {
  totalStudents: 150,
  totalTeachers: 25,
  totalClasses: 12,
  totalLessons: 45,
  activeStudents: 142,
  overduePayments: 3,
  totalRevenue: 15000,
  attendanceRate: 92.5,
  paymentRate: 85.2,
}

export const waitForLoadingToFinish = () => 
  new Promise((resolve) => setTimeout(resolve, 100))
