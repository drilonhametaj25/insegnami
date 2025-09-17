import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { StatsCard } from '@/components/cards/StatsCard'

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  )
}

describe('StatsCard', () => {
  const mockProps = {
    title: 'Total Students',
    value: 150,
    icon: <div data-testid="icon">👥</div>,
    color: 'blue',
    trend: 'up' as const,
    trendValue: '+12.5%'
  }

  it('renders correctly with all props', () => {
    renderWithMantine(<StatsCard {...mockProps} />)
    
    expect(screen.getByText('Total Students')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
  })

  it('renders loading state', () => {
    renderWithMantine(<StatsCard {...mockProps} loading={true} />)
    
    expect(screen.getByText('Total Students')).toBeInTheDocument()
    // Icon and trend should not be visible in loading state
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
    expect(screen.queryByText('+12.5%')).not.toBeInTheDocument()
  })

  it('renders without trend', () => {
    const propsWithoutTrend = {
      ...mockProps,
      trend: undefined,
      trendValue: undefined
    }
    
    renderWithMantine(<StatsCard {...propsWithoutTrend} />)
    
    expect(screen.getByText('Total Students')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.queryByText('+12.5%')).not.toBeInTheDocument()
  })

  it('handles down trend correctly', () => {
    const propsWithDownTrend = { 
      ...mockProps, 
      trend: 'down' as const, 
      trendValue: '-5.2%' 
    }
    
    renderWithMantine(<StatsCard {...propsWithDownTrend} />)
    
    expect(screen.getByText('-5.2%')).toBeInTheDocument()
  })

  it('handles string values', () => {
    const propsWithStringValue = { ...mockProps, value: '€1,250' }
    
    renderWithMantine(<StatsCard {...propsWithStringValue} />)
    
    expect(screen.getByText('€1,250')).toBeInTheDocument()
  })

  it('renders with description', () => {
    const propsWithDescription = { 
      ...mockProps, 
      description: 'Active students in the system' 
    }
    
    renderWithMantine(<StatsCard {...propsWithDescription} />)
    
    expect(screen.getByText('Active students in the system')).toBeInTheDocument()
  })
})
