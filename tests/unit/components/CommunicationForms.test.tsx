import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '../../test-utils'
import { MessageTemplateForm } from '@/components/forms/MessageTemplateForm'
import { CommunicationGroupForm } from '@/components/forms/CommunicationGroupForm'

// Il setup globale mocka @mantine/notifications senza l'export `notifications`:
// qui lo ridefiniamo con la shape usata dai form (notifications.show).
jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
  showNotification: jest.fn(),
  hideNotification: jest.fn(),
}))

// jsdom non implementa scrollIntoView (usato dal Combobox di Mantine)
window.HTMLElement.prototype.scrollIntoView = jest.fn()

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

const mockUsers = [
  { id: 'u1', firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com' },
  { id: 'u2', firstName: 'Anna', lastName: 'Verdi', email: 'anna@example.com' },
]

describe('MessageTemplateForm', () => {
  it('valida i campi obbligatori e non chiama fetch', async () => {
    const user = userEvent.setup()
    render(<MessageTemplateForm onSuccess={jest.fn()} onCancel={jest.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Crea Template' }))

    await waitFor(() => {
      expect(screen.getByText('Nome richiesto')).toBeInTheDocument()
    })
    expect(screen.getByText('Oggetto richiesto')).toBeInTheDocument()
    expect(screen.getByText('Contenuto richiesto')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('invia il payload corretto a POST /api/messages/templates', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'tpl-1', name: 'Benvenuto' }),
    })

    render(<MessageTemplateForm onSuccess={onSuccess} onCancel={jest.fn()} />)

    await user.type(screen.getByLabelText(/Nome/), 'Benvenuto')
    await user.type(screen.getByLabelText(/Oggetto/), 'Benvenuto a scuola')
    await user.type(
      screen.getByLabelText(/Contenuto/),
      'Ciao, benvenuto nella nostra scuola!'
    )

    await user.click(screen.getByRole('button', { name: 'Crea Template' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/messages/templates')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      name: 'Benvenuto',
      subject: 'Benvenuto a scuola',
      content: 'Ciao, benvenuto nella nostra scuola!',
      type: 'MESSAGE',
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })
})

describe('CommunicationGroupForm', () => {
  it('valida nome (min 2) e membri (min 1) e non chiama fetch', async () => {
    const user = userEvent.setup()
    render(
      <CommunicationGroupForm users={mockUsers} onSuccess={jest.fn()} onCancel={jest.fn()} />
    )

    await user.click(screen.getByRole('button', { name: 'Crea Gruppo' }))

    await waitFor(() => {
      expect(screen.getByText('Il nome deve avere almeno 2 caratteri')).toBeInTheDocument()
    })
    expect(screen.getByText('Seleziona almeno un membro')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('invia il payload corretto a POST /api/messages/groups', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ group: { id: 'g1', name: 'Gruppo Test' } }),
    })

    render(
      <CommunicationGroupForm users={mockUsers} onSuccess={onSuccess} onCancel={jest.fn()} />
    )

    await user.type(screen.getByLabelText(/Nome/), 'Gruppo Test')
    await user.type(screen.getByLabelText(/Descrizione/), 'Gruppo di prova')

    // Seleziona un membro dalla MultiSelect (il campo ha anche un input nascosto:
    // puntiamo al solo input visibile tramite il ruolo textbox)
    await user.click(screen.getByRole('textbox', { name: 'Membri' }))
    const option = await screen.findByRole('option', { name: /Mario Rossi/ })
    await user.click(option)

    await user.click(screen.getByRole('button', { name: 'Crea Gruppo' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/messages/groups')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      name: 'Gruppo Test',
      description: 'Gruppo di prova',
      memberIds: ['u1'],
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })
})
