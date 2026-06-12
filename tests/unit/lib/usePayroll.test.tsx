import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  usePayrollPeriods,
  useGeneratePayrolls,
  usePayroll,
  payrollKeys,
} from '@/lib/hooks/usePayroll'

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

describe('usePayroll hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('usePayrollPeriods (lista)', () => {
    it('costruisce la querystring corretta dai filtri year/status', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ periods: [] }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => usePayrollPeriods({ year: 2026, status: 'OPEN' }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/payroll/periods?year=2026&status=OPEN')
    })

    it('chiama l\'endpoint senza querystring se non ci sono filtri', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ periods: [] }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => usePayrollPeriods(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/payroll/periods')
    })
  })

  describe('useGeneratePayrolls (mutation)', () => {
    it('chiama POST /api/payroll/periods/[id]/generate e invalida periodi + cedolini', async () => {
      const mockResult = {
        periodId: 'per-1',
        generated: 3,
        skipped: 1,
        errors: [],
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      })

      const { wrapper, queryClient } = createWrapper()
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useGeneratePayrolls(), { wrapper })

      let data: unknown
      await act(async () => {
        data = await result.current.mutateAsync('per-1')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/payroll/periods/per-1/generate', {
        method: 'POST',
      })
      expect(data).toEqual(mockResult)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: payrollKeys.periods() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: payrollKeys.details() })
    })

    it('lancia un errore con il messaggio del server se la risposta non è ok', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Periodo LOCKED: generazione non consentita' }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useGeneratePayrolls(), { wrapper })

      await expect(
        act(async () => {
          await result.current.mutateAsync('per-1')
        }),
      ).rejects.toThrow('Periodo LOCKED: generazione non consentita')
    })
  })

  describe('usePayroll (dettaglio)', () => {
    it('recupera il singolo cedolino con lineItems e withholdings', async () => {
      const mockPayroll = {
        id: 'pay-1',
        status: 'DRAFT',
        grossAmount: 100,
        netAmount: 80,
        lineItems: [{ id: 'li-1', type: 'HOURS', description: 'Ore', total: 100 }],
        withholdings: [{ id: 'wh-1', type: 'RITENUTA_ACCONTO', label: 'RA 20%', amount: 20 }],
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payroll: mockPayroll }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => usePayroll('pay-1'), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/payroll/pay-1')
      expect(result.current.data?.payroll).toEqual(mockPayroll)
    })
  })
})
