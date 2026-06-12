/**
 * Smoke test C3 — pagina /dashboard/payroll (lista periodi paghe).
 *
 * Pattern: come AnalyticsPage.test.tsx — si mockano gli hook di
 * lib/hooks/usePayroll, si renderizza la pagina e si asserisce sugli
 * elementi chiave (titolo, riga periodo, bottone Nuovo Periodo,
 * espansione con i cedolini del periodo).
 */
import { render, screen, waitFor } from '../../test-utils'
import userEvent from '@testing-library/user-event'
import PayrollPage from '@/app/[locale]/dashboard/payroll/page'

// La pagina usa notifications.show (object API, non coperta dal setup globale)
jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn(), hide: jest.fn() },
}))

const mockPeriods = [
  {
    id: 'period-1',
    tenantId: 'tenant-1',
    year: 2026,
    month: 6,
    status: 'OPEN',
    notes: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    _count: { payrolls: 2 },
    payrolls: [
      {
        id: 'payroll-1',
        status: 'DRAFT',
        netAmount: '800',
        grossBase: '900',
        extrasTotal: '100',
        teacher: { id: 'teacher-1', firstName: 'Mario', lastName: 'Rossi' },
      },
      {
        id: 'payroll-2',
        status: 'APPROVED',
        netAmount: '640.5',
        grossBase: '750',
        extrasTotal: '0',
        teacher: { id: 'teacher-2', firstName: 'Anna', lastName: 'Verdi' },
      },
    ],
  },
  {
    id: 'period-2',
    tenantId: 'tenant-1',
    year: 2026,
    month: 5,
    status: 'LOCKED',
    notes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    _count: { payrolls: 0 },
    payrolls: [],
  },
]

jest.mock('@/lib/hooks/usePayroll', () => ({
  usePayrollPeriods: jest.fn(() => ({
    data: { periods: mockPeriods },
    isLoading: false,
    error: null,
  })),
  useCreatePayrollPeriod: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useGeneratePayrolls: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useLockPeriod: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}))

describe('Payroll Page', () => {
  it('renderizza titolo, stats e righe dei periodi', async () => {
    render(<PayrollPage />)

    await waitFor(() => {
      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toBeInTheDocument()
    })

    // Righe periodo: mese in italiano + anno
    expect(screen.getByText(/Giugno 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/Maggio 2026/i)).toBeInTheDocument()

    // Stati periodo
    expect(screen.getByText('Aperto')).toBeInTheDocument()
    expect(screen.getByText('Bloccato')).toBeInTheDocument()
  })

  it('mostra il bottone Nuovo Periodo per ADMIN (sessione mock globale)', async () => {
    render(<PayrollPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Nuovo Periodo/i })).toBeInTheDocument()
    })
  })

  it('espande un periodo e mostra i cedolini con nome docente e netto', async () => {
    const user = userEvent.setup()
    render(<PayrollPage />)

    const expandButton = await screen.findByLabelText('Espandi periodo Giugno 2026')
    await user.click(expandButton)

    await waitFor(() => {
      expect(screen.getByText(/Mario Rossi/)).toBeInTheDocument()
      expect(screen.getByText(/Anna Verdi/)).toBeInTheDocument()
    })
    // Netto formattato in euro
    expect(screen.getByText('€800,00')).toBeInTheDocument()
  })

  it('gestisce lo stato di caricamento', async () => {
    const { usePayrollPeriods } = require('@/lib/hooks/usePayroll')
    usePayrollPeriods.mockReturnValueOnce({ data: undefined, isLoading: true, error: null })

    render(<PayrollPage />)

    await waitFor(() => {
      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toBeInTheDocument()
    })
  })

  it('gestisce la lista vuota senza errori', async () => {
    const { usePayrollPeriods } = require('@/lib/hooks/usePayroll')
    usePayrollPeriods.mockReturnValueOnce({ data: { periods: [] }, isLoading: false, error: null })

    render(<PayrollPage />)

    await waitFor(() => {
      expect(screen.getByText(/Nessun periodo/i)).toBeInTheDocument()
    })
  })
})
