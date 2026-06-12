import { render, screen, waitFor } from '../../test-utils'
import InvoicesPage from '@/app/[locale]/dashboard/invoices/page'

// Mock degli hook fatturazione (pattern AnalyticsPage.test.tsx)
jest.mock('@/lib/hooks/useInvoices', () => ({
  useInvoices: jest.fn(() => ({
    data: {
      invoices: [
        {
          id: 'inv-issued-1',
          seriesId: 'ser-1',
          customerProfileId: 'cp-1',
          documentType: 'TD01',
          number: 1,
          year: 2026,
          issueDate: '2026-01-15T00:00:00.000Z',
          status: 'ISSUED',
          sdiStatus: 'PENDING',
          subtotal: '100.00',
          vatTotal: '22.00',
          withholdingTotal: '0.00',
          total: '122.00',
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:00:00.000Z',
          series: { code: 'VEN', prefix: 'F' },
          customerProfile: { id: 'cp-1', denominazione: 'ACME SRL', partitaIva: '01234567897' },
          _count: { lines: 1, sdiEvents: 0 },
        },
        {
          id: 'inv-draft-1',
          seriesId: 'ser-1',
          customerProfileId: 'cp-2',
          documentType: 'TD01',
          number: 0,
          year: 2026,
          issueDate: '2026-02-01T00:00:00.000Z',
          status: 'DRAFT',
          sdiStatus: 'PENDING',
          subtotal: '50.00',
          vatTotal: '11.00',
          withholdingTotal: '0.00',
          total: '61.00',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          series: { code: 'VEN', prefix: 'F' },
          customerProfile: { id: 'cp-2', nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA80A01H501U' },
          _count: { lines: 2, sdiEvents: 0 },
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    },
    isLoading: false,
    error: null,
  })),
  useInvoiceSettings: jest.fn(() => ({
    data: { settings: { tenantId: 't1', denominazione: 'Scuola Test', partitaIva: '01234567897' } },
    isLoading: false,
  })),
  useInvoiceSeries: jest.fn(() => ({
    data: { series: [{ id: 'ser-1', code: 'VEN', prefix: 'F', isDefault: true, isActive: true }] },
    isLoading: false,
  })),
  useCustomerProfiles: jest.fn(() => ({
    data: {
      profiles: [
        { id: 'cp-1', denominazione: 'ACME SRL' },
        { id: 'cp-2', nome: 'Mario', cognome: 'Rossi' },
      ],
    },
    isLoading: false,
  })),
}))

describe('Invoices Page', () => {
  it('renderizza titolo, azioni principali e stats', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /fatture/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /nuova fattura/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /impostazioni/i })).toBeInTheDocument()

    // Stats card: totale fatture dal pagination.total
    expect(screen.getByText('Totale fatture')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('mostra le fatture con numero formattato, cliente e doppio badge stato/SDI', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      // Fattura emessa: numero F/2026/0001
      expect(screen.getByText('F/2026/0001')).toBeInTheDocument()
    })

    // Clienti (denominazione e persona fisica) — compaiono anche nel filtro
    // clienti (opzioni Select renderizzate nascoste), quindi getAllByText
    expect(screen.getAllByText('ACME SRL').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Mario Rossi').length).toBeGreaterThanOrEqual(1)

    // Badge stato applicativo (i label compaiono anche nelle opzioni del
    // filtro stato, renderizzate nascoste nel DOM)
    expect(screen.getAllByText('Emessa').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bozza').length).toBeGreaterThanOrEqual(1)

    // Badge stato SDI separato
    expect(screen.getAllByText('Non trasmessa').length).toBeGreaterThanOrEqual(1)

    // Totale formattato in euro
    expect(screen.getByText(/122,00/)).toBeInTheDocument()
  })

  it('mostra il vuoto-stato con CTA alle impostazioni quando mancano settings e sezionali', async () => {
    const { useInvoices, useInvoiceSettings, useInvoiceSeries } = require('@/lib/hooks/useInvoices')

    useInvoices.mockReturnValue({
      data: { invoices: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    })
    useInvoiceSettings.mockReturnValue({ data: { settings: null }, isLoading: false })
    useInvoiceSeries.mockReturnValue({ data: { series: [] }, isLoading: false })

    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText(/configura la fatturazione/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /vai alle impostazioni/i })).toBeInTheDocument()
  })

  it('gestisce lo stato di caricamento senza crash', async () => {
    const { useInvoices } = require('@/lib/hooks/useInvoices')
    useInvoices.mockReturnValue({ data: undefined, isLoading: true, error: null })

    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /fatture/i })).toBeInTheDocument()
    })
  })
})
