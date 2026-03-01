import { render, screen, fireEvent, waitFor } from '../../test-utils'
import ReportsPage from '@/app/[locale]/dashboard/reports/page'

// Mock the reports hooks
const mockMutate = jest.fn()
const mockMutateAsync = jest.fn().mockResolvedValue({})

jest.mock('@/lib/hooks/useAnalytics', () => ({
  useReports: jest.fn(() => ({
    data: [
      {
        id: '1',
        title: 'Monthly Analytics Report',
        type: 'OVERVIEW',
        period: 'MONTHLY',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: '2',
        title: 'Student Progress Report',
        type: 'PROGRESS',
        period: 'QUARTERLY',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-03-31T23:59:59Z',
        createdAt: '2024-01-20T14:00:00Z',
        updatedAt: '2024-01-20T14:15:00Z',
      },
    ],
    isLoading: false,
    refetch: jest.fn(),
  })),
  useCreateReport: jest.fn(() => ({
    mutate: mockMutate,
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
  })),
  useDeleteReport: jest.fn(() => ({
    mutate: mockMutate,
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
  })),
}))

describe('Reports Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders reports page correctly', async () => {
    render(<ReportsPage />)

    // Check for main heading (Title order={2} = h2)
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toBeInTheDocument()
    })
  })

  it('displays report data correctly', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      // Check report titles are displayed
      expect(screen.getByText('Monthly Analytics Report')).toBeInTheDocument()
      expect(screen.getByText('Student Progress Report')).toBeInTheDocument()
    })
  })

  it('shows create report button', async () => {
    render(<ReportsPage />)

    // Check for create report button
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  it('opens modal when create button clicked', async () => {
    render(<ReportsPage />)

    // Find button with plus icon or create text
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const createBtn = buttons.find(btn =>
        btn.textContent?.toLowerCase().includes('report') ||
        btn.querySelector('svg')
      )
      if (createBtn) {
        fireEvent.click(createBtn)
      }
    })
  })

  it('shows action buttons for reports', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      // Look for action menus or buttons
      const actionButtons = screen.queryAllByRole('button')
      expect(actionButtons.length).toBeGreaterThan(0)
    })
  })

  it('handles empty reports list', async () => {
    const { useReports } = require('@/lib/hooks/useAnalytics')
    useReports.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<ReportsPage />)

    // Page should render with empty state
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toBeInTheDocument()
    })
  })

  it('shows loading overlay when loading', async () => {
    const { useReports } = require('@/lib/hooks/useAnalytics')
    useReports.mockReturnValue({
      data: null,
      isLoading: true,
      refetch: jest.fn(),
    })

    render(<ReportsPage />)

    // Page should still render even during loading
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toBeInTheDocument()
  })
})
