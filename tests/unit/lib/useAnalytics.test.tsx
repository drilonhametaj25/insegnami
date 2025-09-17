import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOverviewStats, useAttendanceStats } from '@/lib/hooks/useAnalytics'

// Mock fetch globally
global.fetch = jest.fn()

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useAnalytics hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useOverviewStats', () => {
    it('fetches overview stats successfully', async () => {
      const mockData = {
        totalStudents: 150,
        totalTeachers: 25,
        totalClasses: 12,
        totalLessons: 45,
        activeStudents: 142,
        overduePayments: 3,
        totalRevenue: 15000,
        attendanceRate: 92.5,
        paymentRate: 85.2
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(() => useOverviewStats('30'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      
      expect(result.current.data).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalledWith('/api/analytics?type=overview&period=30')
    })

    it('handles fetch errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() => useOverviewStats('30'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      
      expect(result.current.error).toBeTruthy()
    })

    it('uses correct period parameter', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      renderHook(() => useOverviewStats('90'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => 
        expect(global.fetch).toHaveBeenCalledWith('/api/analytics?type=overview&period=90')
      )
    })
  })

  describe('useAttendanceStats', () => {
    it('fetches attendance stats successfully', async () => {
      const mockData = {
        byStatus: [
          { status: 'PRESENT', _count: { status: 120 } },
          { status: 'ABSENT', _count: { status: 15 } },
          { status: 'LATE', _count: { status: 5 } }
        ],
        daily: {
          '2024-01-01': 25,
          '2024-01-02': 28,
          '2024-01-03': 22
        },
        totalRecords: 140
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(() => useAttendanceStats('30'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      
      expect(result.current.data).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalledWith('/api/analytics?type=attendance&period=30')
    })

    it('handles empty attendance data', async () => {
      const mockData = {
        byStatus: [],
        daily: {},
        totalRecords: 0
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(() => useAttendanceStats('7'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      
      expect(result.current.data).toEqual(mockData)
      expect(result.current.data?.totalRecords).toBe(0)
    })
  })
})
