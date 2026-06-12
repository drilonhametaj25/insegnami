import { render, screen } from '../../test-utils'
import userEvent from '@testing-library/user-event'
import { RecurringScopeModal } from '@/components/modals/RecurringScopeModal'

describe('RecurringScopeModal', () => {
  it('renders the 3 scope options', () => {
    render(
      <RecurringScopeModal
        opened
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />
    )

    expect(screen.getByLabelText('Solo questa lezione')).toBeInTheDocument()
    expect(screen.getByLabelText('Tutta la serie')).toBeInTheDocument()
    expect(screen.getByLabelText('Da qui in avanti')).toBeInTheDocument()
  })

  it('calls onConfirm with the default scope (single)', async () => {
    const user = userEvent.setup()
    const onConfirm = jest.fn()

    render(
      <RecurringScopeModal
        opened
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Conferma' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('single')
  })

  it('calls onConfirm with the selected scope', async () => {
    const user = userEvent.setup()
    const onConfirm = jest.fn()

    render(
      <RecurringScopeModal
        opened
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByLabelText('Tutta la serie'))
    await user.click(screen.getByRole('button', { name: 'Conferma' }))

    expect(onConfirm).toHaveBeenCalledWith('series')
  })

  it('calls onConfirm with "future" when selected', async () => {
    const user = userEvent.setup()
    const onConfirm = jest.fn()

    render(
      <RecurringScopeModal
        opened
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByLabelText('Da qui in avanti'))
    await user.click(screen.getByRole('button', { name: 'Conferma' }))

    expect(onConfirm).toHaveBeenCalledWith('future')
  })

  it('calls onClose when cancelling without confirming', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onConfirm = jest.fn()

    render(
      <RecurringScopeModal
        opened
        onClose={onClose}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not render content when closed', () => {
    render(
      <RecurringScopeModal
        opened={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />
    )

    expect(screen.queryByLabelText('Solo questa lezione')).not.toBeInTheDocument()
  })
})
