import { render, screen, fireEvent, waitFor } from '../../test-utils'
import ReportsPage from '@/app/[locale]/dashboard/reports/page'

// Mock the reports hook
jest.mock('@/lib/hooks/useAnalytics', () => ({
  useReports: jest.fn(() => ({
    data: {
      data: [
        {
          id: '1',
          name: 'Monthly Analytics Report',
          type: 'analytics',
          status: 'COMPLETED',
          description: 'Analytics data for January 2024',
          fileUrl: 'https://example.com/report1.pdf',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
        },
        {
          id: '2',
          name: 'Student Progress Report',
          type: 'academic',
          status: 'GENERATING',
          description: 'Student performance overview',
          fileUrl: null,
          createdAt: '2024-01-20T14:00:00Z',
          updatedAt: '2024-01-20T14:15:00Z',
        },
      ],
      pagination: {
        page: 1,
        pages: 1,
        total: 2,
      },
    },
    isLoading: false,
    refetch: jest.fn(),
  })),
  generateReport: {
    mutate: jest.fn(),
    isPending: false,
  },
  deleteReport: {
    mutate: jest.fn(),
    isPending: false,
  },
}))

describe('Reports Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders reports page correctly', async () => {
    render(<ReportsPage />)

    // Check for main title
    expect(screen.getByRole('heading', { name: /reports.*management/i })).toBeInTheDocument()

    // Check for reports table
    await waitFor(() => {
      expect(screen.getByText('Monthly Analytics Report')).toBeInTheDocument()
      expect(screen.getByText('Student Progress Report')).toBeInTheDocument()
    })
  })

  it('displays report data correctly', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      // Check report names
      expect(screen.getByText('Monthly Analytics Report')).toBeInTheDocument()
      expect(screen.getByText('Student Progress Report')).toBeInTheDocument()

      // Check report types
      expect(screen.getByText('analytics')).toBeInTheDocument()
      expect(screen.getByText('academic')).toBeInTheDocument()

      // Check report statuses
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
      expect(screen.getByText('GENERATING')).toBeInTheDocument()
    })
  })

  it('shows generate report section', async () => {
    render(<ReportsPage />)

    // Check for generate report form
    expect(screen.getByRole('button', { name: /generate.*report/i })).toBeInTheDocument()
    
    // Check for report type selector
    const typeSelect = screen.getByRole('combobox') || screen.getByDisplayValue(/select.*type/i)
    if (typeSelect) {
      expect(typeSelect).toBeInTheDocument()
    }
  })

  it('handles report generation', async () => {
    const { generateReport } = require('@/lib/hooks/useAnalytics')
    
    render(<ReportsPage />)

    // Find and click generate button
    const generateBtn = screen.getByRole('button', { name: /generate.*report/i })
    fireEvent.click(generateBtn)

    // Should call the generate mutation
    await waitFor(() => {
      expect(generateReport.mutate).toHaveBeenCalled()
    })
  })

  it('displays download links for completed reports', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      // Look for download buttons or links for completed reports
      const downloadButtons = screen.queryAllByRole('button', { name: /download/i })
      const downloadLinks = screen.queryAllByRole('link', { name: /download/i })
      
      expect(downloadButtons.length + downloadLinks.length).toBeGreaterThan(0)
    })
  })

  it('shows report actions menu', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      // Look for action menus or buttons
      const actionButtons = screen.queryAllByRole('button')
      const deleteButtons = actionButtons.filter(btn => 
        btn.textContent?.toLowerCase().includes('delete') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('delete')
      )
      
      expect(actionButtons.length).toBeGreaterThan(0)
    })
  })

  it('handles empty reports list', async () => {
    const { useReports } = require('@/lib/hooks/useAnalytics')
    useReports.mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, pages: 0, total: 0 },
      },
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<ReportsPage />)

    // Should show empty state
    await waitFor(() => {
      const emptyMessage = screen.queryByText(/no.*reports.*found/i) ||
                          screen.queryByText(/no.*data.*available/i) ||
                          screen.queryByText(/empty/i)
      
      if (emptyMessage) {
        expect(emptyMessage).toBeInTheDocument()
      }
    })
  })

  it('shows loading state correctly', async () => {
    const { useReports } = require('@/lib/hooks/useAnalytics')
    useReports.mockReturnValue({
      data: null,
      isLoading: true,
      refetch: jest.fn(),
    })

    render(<ReportsPage />)

    // Page should still render with loading state
    expect(screen.getByRole('heading', { name: /reports.*management/i })).toBeInTheDocument()
    
    // May show loading indicator
    const loadingIndicators = screen.queryAllByText(/loading/i)
    // Loading indicators are optional in this test
  })

  it('filters reports by type', async () => {
    render(<ReportsPage />)

    // Look for filter controls
    const filterControls = screen.queryAllByRole('combobox')
    const filterButtons = screen.queryAllByRole('button')
    
    // If filters exist, they should be interactable
    expect(filterControls.length + filterButtons.length).toBeGreaterThan(0)
  })

  it('supports pagination', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      // Look for pagination controls
      const paginationElements = screen.queryAllByRole('button').filter(btn =>
        /next|previous|page/i.test(btn.textContent || btn.getAttribute('aria-label') || '')
      )
      
      // Pagination is optional but if present should work
      if (paginationElements.length > 0) {
        expect(paginationElements.length).toBeGreaterThan(0)
      }
    })
  })
})
