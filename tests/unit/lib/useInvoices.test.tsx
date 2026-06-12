import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useInvoices,
  useIssueInvoice,
  useCustomerProfiles,
  invoicesKeys,
} from '@/lib/hooks/useInvoices'

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

describe('useInvoices hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useInvoices (lista)', () => {
    it('costruisce la querystring corretta dai filtri', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          invoices: [],
          pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
        }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () =>
          useInvoices(2, 10, {
            status: 'DRAFT',
            sdiStatus: 'NOT_SENT',
            year: 2026,
            customerProfileId: 'cp-1',
          }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/invoices?page=2&pageSize=10&status=DRAFT&sdiStatus=NOT_SENT&year=2026&customerProfileId=cp-1',
      )
    })

    it('omette i filtri vuoti o undefined', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          invoices: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => useInvoices(1, 20, { status: '', year: undefined }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/invoices?page=1&pageSize=20')
    })

    it('propaga gli errori di fetch', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useInvoices(), { wrapper })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('useIssueInvoice (mutation)', () => {
    it('chiama POST /api/invoices/[id]/issue e invalida lista + dettaglio', async () => {
      const mockInvoice = { id: 'inv-1', status: 'ISSUED', number: 1, year: 2026 }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoice: mockInvoice }),
      })

      const { wrapper, queryClient } = createWrapper()
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useIssueInvoice(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync('inv-1')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/invoices/inv-1/issue', {
        method: 'POST',
      })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: invoicesKeys.lists() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: invoicesKeys.detail('inv-1') })
    })

    it('lancia un errore con il messaggio del server se la risposta non è ok', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Fattura già emessa (stato: ISSUED)' }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useIssueInvoice(), { wrapper })

      await expect(
        act(async () => {
          await result.current.mutateAsync('inv-1')
        }),
      ).rejects.toThrow('Fattura già emessa (stato: ISSUED)')
    })
  })

  describe('useCustomerProfiles', () => {
    it('costruisce la querystring con search e studentId', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profiles: [] }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => useCustomerProfiles({ search: 'Rossi', studentId: 'stu-1' }),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/invoices/customer-profiles?search=Rossi&studentId=stu-1',
      )
    })

    it('chiama l\'endpoint senza querystring se non ci sono filtri', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profiles: [] }),
      })

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useCustomerProfiles(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(global.fetch).toHaveBeenCalledWith('/api/invoices/customer-profiles')
    })
  })
})
