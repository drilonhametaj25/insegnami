import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Simple component test without complex providers
describe('Basic Component Tests', () => {
  it('renders a simple React component', () => {
    const TestComponent = () => <div>Test Component</div>
    
    render(<TestComponent />)
    
    expect(screen.getByText('Test Component')).toBeInTheDocument()
  })

  it('renders with props', () => {
    const TestComponent = ({ title }: { title: string }) => (
      <div>
        <h1>{title}</h1>
        <p>Content</p>
      </div>
    )
    
    render(<TestComponent title="Hello World" />)
    
    expect(screen.getByText('Hello World')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello World')
  })

  it('handles conditional rendering', () => {
    const ConditionalComponent = ({ show }: { show: boolean }) => (
      <div>
        {show ? <span>Visible</span> : <span>Hidden</span>}
      </div>
    )
    
    const { rerender } = render(<ConditionalComponent show={true} />)
    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    
    rerender(<ConditionalComponent show={false} />)
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.queryByText('Visible')).not.toBeInTheDocument()
  })

  it('renders lists correctly', () => {
    const items = ['Item 1', 'Item 2', 'Item 3']
    const ListComponent = ({ items }: { items: string[] }) => (
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    )
    
    render(<ListComponent items={items} />)
    
    items.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
    
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('handles empty states', () => {
    const EmptyStateComponent = ({ isEmpty }: { isEmpty: boolean }) => (
      <div>
        {isEmpty ? (
          <div>No data available</div>
        ) : (
          <div>Data is present</div>
        )}
      </div>
    )
    
    render(<EmptyStateComponent isEmpty={true} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })
})
