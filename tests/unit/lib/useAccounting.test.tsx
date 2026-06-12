import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useAccountingMovements,
  useCreateMovement,
  usePnL,
  accountingKeys,
} from '@/lib/hooks/useAccounting'

// Mock di fetch globale (pattern useAnalytics.test.tsx)
global.fetch = jest.fn()

// Wrapper con QueryClient reale: ritorna anche il client per spiare le invalidation
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { wrapper, queryClient }
}

describe('useAccounting hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useAccountingMovements (lista)', () => {
    it('costruisce la querystring corretta da filtri e paginazione', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          movements: [],
          pagination: { page: 2, pageSize: 25, total: 0, totalPages: 0 },
        }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () =>
          useAccountingMovements(2, 25, {
            type: 'COST',
            source: 'PAYROLL',
            category: 'stipendi',
            from: '2026-01-01',
            to: '2026-06-30',
          }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/accounting/movements?page=2&pageSize=25&type=COST&source=PAYROLL&category=stipendi&from=2026-01-01&to=2026-06-30',
      )
    })

    it('omette i filtri vuoti o undefined', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          movements: [],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
        }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => useAccountingMovements(1, 50, { type: '', category: undefined }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/movements?page=1&pageSize=50')
    })
  })

  describe('useCreateMovement (mutation)', () => {
    it('chiama POST /api/accounting/movements con il body JSON e invalida movimenti + pnl', async () => {
      const input = {
        date: '2026-06-12',
        type: 'COST' as const,
        category: 'affitto',
        amount: 1200,
        description: 'Affitto sede giugno',
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ movement: { id: 'mov-1', ...input, source: 'MANUAL' } }),
      })

      const { wrapper, queryClient } = createWrapper()
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCreateMovement(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync(input)
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountingKeys.movements() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountingKeys.pnls() })
    })

    it('lancia un errore con il messaggio del server se la risposta non è ok', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Dati non validi' }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useCreateMovement(), { wrapper })

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            date: '2026-06-12',
            type: 'COST',
            category: 'x',
            amount: -1,
          })
        }),
      ).rejects.toThrow('Dati non validi')
    })
  })

  describe('usePnL', () => {
    it('passa from/to/trend nella querystring', async () => {
      const mockReport = {
        period: { start: '2026-01-01', end: '2026-06-30' },
        revenues: [],
        revenueTotal: 0,
        costs: [],
        costTotal: 0,
        netMargin: 0,
        marginPct: 0,
        movementCount: 0,
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ report: mockReport, trend: [] }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => usePnL({ from: '2026-01-01', to: '2026-06-30', trend: 12 }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/accounting/pnl?from=2026-01-01&to=2026-06-30&trend=12',
      )
      expect(result.current.data?.report).toEqual(mockReport)
    })

    it('chiama l\'endpoint senza querystring se non ci sono parametri', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ report: null, trend: null }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => usePnL(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/pnl')
    })
  })
})
