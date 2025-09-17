import { render, screen } from '../../test-utils'

// Simple test first
describe('Simple Test', () => {
  it('renders a simple div', () => {
    const { container } = render(<div>Hello World</div>)
    expect(container.firstChild).toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
