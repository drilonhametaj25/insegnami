import { render, screen, waitFor } from '../../test-utils'
import DashboardStats from '@/components/cards/DashboardStats'

// DashboardStats is a pure presentational component driven by its `data` prop
// (the dashboard page feeds it real values from /api/analytics). It no longer
// invents fallback numbers or fake trends, so the tests assert real behaviour:
// passing data renders those values + derived badges/progress; no data renders
// zeros / em-dashes, never fabricated figures.

// Realistic admin payload used to exercise badges + progress.
const adminData = {
  students: 150,
  teachers: 25,
  classes: 12,
  lessons: 45,
  revenue: 15000,
  attendance: 92,
  pendingPayments: 3,
  upcomingLessons: 5,
}

describe('DashboardStats Component', () => {
  it('renders the admin stat titles and real values', async () => {
    render(<DashboardStats role="ADMIN" data={adminData} />)

    await waitFor(() => {
      expect(screen.getByText(/studenti attivi/i)).toBeInTheDocument()
      expect(screen.getByText(/docenti/i)).toBeInTheDocument()
      expect(screen.getByText(/classi attive/i)).toBeInTheDocument()
      expect(screen.getByText(/fatturato/i)).toBeInTheDocument()
    })

    // Real values from the data prop (no fabricated defaults like 156/12)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('renders without crashing when no data is provided', () => {
    render(<DashboardStats role="ADMIN" />)
    expect(screen.getByText(/studenti attivi/i)).toBeInTheDocument()
  })

  it('does NOT fabricate fake fallback numbers when data is absent', () => {
    render(<DashboardStats role="ADMIN" />)
    // The old fake defaults must be gone.
    expect(screen.queryByText('156')).not.toBeInTheDocument()
    // Missing metrics render as 0, not invented figures.
    const zeros = screen.queryAllByText('0')
    expect(zeros.length).toBeGreaterThan(0)
  })

  it('derives real ratio badges instead of fake trends', async () => {
    render(<DashboardStats role="ADMIN" data={adminData} />)

    await waitFor(() => {
      // 150 students / 25 teachers -> "6 std/doc"; no "+12% questo mese" anymore.
      const badges = screen.queryAllByText(/std\/doc|std\/classe|in sospeso|prossime/i)
      expect(badges.length).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/questo mese|vs mese scorso|ultimo trimestre/i)).not.toBeInTheDocument()
  })

  it('labels the analytics window on admin cards', async () => {
    render(<DashboardStats role="ADMIN" data={adminData} />)
    await waitFor(() => {
      // Titles now carry a concrete window ("Fatturato (30gg)", "Lezioni (30gg)").
      const windowed = screen.queryAllByText(/30gg/i)
      expect(windowed.length).toBeGreaterThan(0)
    })
  })

  it('formats currency and percentage from real data', async () => {
    render(<DashboardStats role="ADMIN" data={adminData} />)
    await waitFor(() => {
      expect(screen.queryAllByText(/€/).length).toBeGreaterThan(0)
      expect(screen.queryAllByText(/%/).length).toBeGreaterThan(0)
    })
  })

  it('handles empty (all-zero) data gracefully', async () => {
    const customData = {
      students: 0,
      teachers: 0,
      classes: 0,
      lessons: 0,
      revenue: 0,
      attendance: 0,
      pendingPayments: 0,
      upcomingLessons: 0,
    }

    render(<DashboardStats role="ADMIN" data={customData} />)

    await waitFor(() => {
      const zeroElements = screen.queryAllByText('0')
      expect(zeroElements.length).toBeGreaterThan(0)
    })
  })

  it('renders an em-dash for attendance when not provided', () => {
    render(<DashboardStats role="ADMIN" data={{ students: 10 }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows a progress bar only when real attendance is supplied', async () => {
    const { rerender } = render(<DashboardStats role="ADMIN" data={{ students: 10 }} />)
    // No attendance -> no progress bar (we never fake one).
    expect(screen.queryAllByRole('progressbar').length).toBe(0)

    rerender(<DashboardStats role="ADMIN" data={adminData} />)
    await waitFor(() => {
      expect(screen.queryAllByRole('progressbar').length).toBeGreaterThan(0)
    })
  })

  it('displays different stats based on user role', async () => {
    const { rerender } = render(<DashboardStats role="ADMIN" data={adminData} />)
    expect(screen.getByText(/studenti attivi/i)).toBeInTheDocument()
    expect(screen.getByText(/fatturato/i)).toBeInTheDocument()

    rerender(<DashboardStats role="TEACHER" data={adminData} />)
    expect(screen.getByText(/i miei studenti/i)).toBeInTheDocument()
    expect(screen.getByText(/classi assegnate/i)).toBeInTheDocument()

    rerender(<DashboardStats role="STUDENT" data={adminData} />)
    expect(screen.getByText(/corsi attivi/i)).toBeInTheDocument()
    expect(screen.getByText(/frequenza/i)).toBeInTheDocument()

    rerender(<DashboardStats role="PARENT" data={adminData} />)
    expect(screen.getByText(/figli iscritti/i)).toBeInTheDocument()
    expect(screen.getByText(/pagamenti in sospeso/i)).toBeInTheDocument()
  })
})
