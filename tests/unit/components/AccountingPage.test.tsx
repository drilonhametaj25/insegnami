import { render, screen, waitFor } from '../../test-utils'
import AccountingPage from '@/app/[locale]/dashboard/accounting/page'

// Mock notifications (la pagina/form usano notifications.show)
jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
  showNotification: jest.fn(),
  hideNotification: jest.fn(),
}))

// Mock hook contabilità (shape reale: { movements, pagination } / { report, trend })
jest.mock('@/lib/hooks/useAccounting', () => ({
  useAccountingMovements: jest.fn(() => ({
    data: {
      movements: [
        {
          id: 'mov1',
          tenantId: 't1',
          date: '2026-06-01T00:00:00.000Z',
          type: 'COST',
          source: 'MANUAL',
          category: 'affitto',
          amount: '1200',
          currency: 'EUR',
          description: 'Affitto sede giugno',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'mov2',
          tenantId: 't1',
          date: '2026-06-05T00:00:00.000Z',
          type: 'REVENUE',
          source: 'PAYMENT',
          category: 'rette',
          amount: '350',
          currency: 'EUR',
          description: 'Retta giugno Mario Rossi',
          createdAt: '2026-06-05T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    },
    isLoading: false,
    error: null,
  })),
  useCreateMovement: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  usePnL: jest.fn(() => ({
    data: {
      report: {
        period: { start: '2026-06-01', end: '2026-06-30' },
        revenues: [{ category: 'rette', total: 5000, count: 10 }],
        revenueTotal: 5000,
        costs: [
          { category: 'stipendi', total: 3000, count: 2 },
          { category: 'affitto', total: 1200, count: 1 },
        ],
        costTotal: 4200,
        netMargin: 800,
        marginPct: 16,
        movementCount: 13,
      },
      trend: [
        { year: 2026, month: 5, revenue: 4000, cost: 3500, margin: 500 },
        { year: 2026, month: 6, revenue: 5000, cost: 4200, margin: 800 },
      ],
    },
    isLoading: false,
  })),
}))

// Mock hook di supporto usati dal form per le allocazioni opzionali
jest.mock('@/lib/hooks/useClasses', () => ({
  useClasses: jest.fn(() => ({
    data: { classes: [{ id: 'c1', name: 'Inglese A1' }] },
    isLoading: false,
  })),
}))

jest.mock('@/lib/hooks/useCourses', () => ({
  useCourses: jest.fn(() => ({
    data: { courses: [{ id: 'co1', name: 'Corso Inglese' }] },
    isLoading: false,
  })),
}))

jest.mock('@/lib/hooks/useStudents', () => ({
  useStudents: jest.fn(() => ({
    data: { students: [{ id: 's1', firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com' }] },
    isLoading: false,
  })),
}))

describe('Accounting Page', () => {
  it('renderizza titolo e tab Movimenti / P&L', async () => {
    render(<AccountingPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: /movimenti/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /p&l/i })).toBeInTheDocument()
  })

  it('mostra i movimenti in tabella con tipo, source e categoria', async () => {
    render(<AccountingPage />)

    await waitFor(() => {
      expect(screen.getByText('Affitto sede giugno')).toBeInTheDocument()
    })

    expect(screen.getByText('Retta giugno Mario Rossi')).toBeInTheDocument()
    // Badge tipo (Costo/Ricavo)
    expect(screen.getAllByText('Costo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ricavo').length).toBeGreaterThan(0)
    // Source
    expect(screen.getAllByText('Manuale').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pagamento').length).toBeGreaterThan(0)
    // Categorie
    expect(screen.getAllByText('affitto').length).toBeGreaterThan(0)
    expect(screen.getAllByText('rette').length).toBeGreaterThan(0)
  })

  it('mostra il bottone Nuovo Movimento', async () => {
    render(<AccountingPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuovo movimento/i })).toBeInTheDocument()
    })
  })

  it('mostra le card P&L (Ricavi/Costi/Risultato Netto) con i totali del report', async () => {
    render(<AccountingPage />)

    // I pannelli Tabs di Mantine restano montati (keepMounted default)
    await waitFor(() => {
      expect(screen.getAllByText(/risultato netto/i).length).toBeGreaterThan(0)
    })

    // Totali formattati in euro con la stessa chiamata del componente:
    // il grouping it-IT sui numeri a 4 cifre cambia tra versioni ICU
    // ("5000,00" su macOS, "5.000,00" su alcune CI), quindi l'atteso va
    // calcolato a runtime, non hardcoded.
    const euroIt = (n: number) =>
      n
        .toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(screen.getAllByText(new RegExp(euroIt(5000))).length).toBeGreaterThan(0) // revenueTotal
    expect(screen.getAllByText(new RegExp(euroIt(4200))).length).toBeGreaterThan(0) // costTotal
    expect(screen.getAllByText(new RegExp(euroIt(800))).length).toBeGreaterThan(0) // netMargin

    // Breakdown per categoria
    expect(screen.getAllByText('stipendi').length).toBeGreaterThan(0)
  })

  it('gestisce lo stato senza dati senza crashare', async () => {
    const { useAccountingMovements, usePnL } = require('@/lib/hooks/useAccounting')
    useAccountingMovements.mockReturnValue({ data: undefined, isLoading: true, error: null })
    usePnL.mockReturnValue({ data: undefined, isLoading: true })

    render(<AccountingPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    })
  })
})
