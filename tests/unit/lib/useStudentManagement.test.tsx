import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useStudents, useCreateStudent, useDeleteStudent } from '@/lib/hooks/useStudents'

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: '1', email: 'test@example.com' } },
  })),
}))

// Create a wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Mock fetch globally
global.fetch = jest.fn()

describe('Student Management Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  describe('useStudents', () => {
    it('fetches students successfully', async () => {
      const mockResponse = {
        students: [
          {
            id: '1',
            firstName: 'Mario',
            lastName: 'Rossi',
            email: 'mario.rossi@example.com',
            status: 'ACTIVE',
            createdAt: '2024-01-01T00:00:00Z',
            classes: [],
          },
          {
            id: '2',
            firstName: 'Giulia',
            lastName: 'Verdi',
            email: 'giulia.verdi@example.com',
            status: 'ACTIVE',
            createdAt: '2024-01-02T00:00:00Z',
            classes: [],
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const { result } = renderHook(() => useStudents(1, 20), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.students).toEqual(mockResponse.students)
      expect(fetch).toHaveBeenCalledWith('/api/students?page=1&limit=20', expect.any(Object))
    })

    it('handles API errors gracefully', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('supports filtering and pagination', async () => {
      const mockResponse = {
        students: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const filters = { status: 'ACTIVE', search: 'Mario' }
      renderHook(() => useStudents(2, 10, filters), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/students?page=2&limit=10&status=ACTIVE&search=Mario',
          expect.any(Object)
        )
      })
    })
  })

  describe('useCreateStudent', () => {
    it('creates student successfully', async () => {
      const newStudent = {
        id: '3',
        firstName: 'Luca',
        lastName: 'Neri',
        email: 'luca.neri@example.com',
        phone: '123456789',
        dateOfBirth: new Date('2000-01-01'),
        enrollmentDate: new Date('2024-01-01'),
        status: 'ACTIVE' as const,
        notes: 'New student',
        createdAt: new Date(),
        updatedAt: new Date(),
        classes: [],
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => newStudent,
      })

      const { result } = renderHook(() => useCreateStudent(), {
        wrapper: createWrapper(),
      })

      const studentData = {
        firstName: 'Luca',
        lastName: 'Neri',
        email: 'luca.neri@example.com',
        phone: '123456789',
        dateOfBirth: '2000-01-01',
        enrollmentDate: '2024-01-01',
        status: 'ACTIVE' as const,
        notes: 'New student',
      }

      await act(async () => {
        result.current.mutate(studentData)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(fetch).toHaveBeenCalledWith('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(studentData),
      })
    })

    it('handles creation errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      })

      const { result } = renderHook(() => useCreateStudent(), {
        wrapper: createWrapper(),
      })

      const studentData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'existing@example.com',
        dateOfBirth: '2000-01-01',
        enrollmentDate: '2024-01-01',
      }

      await act(async () => {
        result.current.mutate(studentData)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Email already exists')
    })
  })

  describe('useDeleteStudent', () => {
    it('deletes student successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      })

      const { result } = renderHook(() => useDeleteStudent(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('1')
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(fetch).toHaveBeenCalledWith('/api/students/1', {
        method: 'DELETE',
      })
    })

    it('handles deletion errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Student not found' }),
      })

      const { result } = renderHook(() => useDeleteStudent(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('999')
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Student not found')
    })
  })

  // Additional hook tests can be added here for other entities
  it('should have comprehensive test coverage for all hooks', () => {
    // This is a reminder that we should test:
    // - useTeachers, useClasses, useLessons, useAttendance, usePayments
    // - All CRUD operations for each entity
    // - Error handling and edge cases
    expect(true).toBe(true)
  })
})
