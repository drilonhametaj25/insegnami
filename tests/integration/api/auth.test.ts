import { POST } from '@/app/api/auth/register/route'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userTenant: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}))

jest.mock('@/lib/config', () => ({
  isSaaSMode: true,
}))

jest.mock('@/lib/auth-utils', () => ({
  generateVerificationToken: jest.fn(() => 'mock-verification-token'),
}))

jest.mock('@/lib/api-middleware', () => ({
  escapeHtml: (str: string) => str.replace(/[&<>"']/g, ''),
}))

jest.mock('@/lib/stripe', () => ({
  getOrCreateCustomer: jest.fn(() => Promise.resolve({ id: 'cus_mock' })),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}))

const { prisma } = require('@/lib/db')
const { sendEmail } = require('@/lib/email')

function createRequest(body: any) {
  return {
    json: () => Promise.resolve(body),
  } as any
}

describe('/api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sendEmail.mockResolvedValue({ success: true })
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Test School',
      slug: 'test-school',
    })
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
    })
    prisma.userTenant.create.mockResolvedValue({})
    prisma.verificationToken.create.mockResolvedValue({})
    prisma.tenant.update.mockResolvedValue({})
  })

  it('registers a valid user and creates Tenant + VerificationToken', async () => {
    const req = createRequest({
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@scuola.it',
      password: 'Password1',
      schoolName: 'Scuola Test',
      role: 'admin',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('test@example.com')
    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Scuola Test' }),
      })
    )
    expect(prisma.verificationToken.create).toHaveBeenCalled()
    expect(sendEmail).toHaveBeenCalled()
  })

  it('rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' })

    const req = createRequest({
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'existing@scuola.it',
      password: 'Password1',
      schoolName: 'Scuola Test',
      role: 'admin',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Impossibile completare la registrazione')
    expect(prisma.tenant.create).not.toHaveBeenCalled()
  })

  it('rejects weak password (too short)', async () => {
    const req = createRequest({
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@scuola.it',
      password: 'short',
      schoolName: 'Scuola Test',
      role: 'admin',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('almeno 8 caratteri')
  })

  it('rejects password without complexity requirements', async () => {
    const req = createRequest({
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@scuola.it',
      password: 'alllowercase1',
      schoolName: 'Scuola Test',
      role: 'admin',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('minuscola, una maiuscola e un numero')
  })

  it('rejects missing required fields', async () => {
    const req = createRequest({
      firstName: 'Mario',
      // missing lastName, email, password, schoolName
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('obbligatori')
  })

  it('rejects invalid email format', async () => {
    const req = createRequest({
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'not-an-email',
      password: 'Password1',
      schoolName: 'Scuola Test',
      role: 'admin',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('email non valido')
  })

  it('rolls back when email sending fails', async () => {
    sendEmail.mockResolvedValue({ success: false })

    const req = createRequest({
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@scuola.it',
      password: 'Password1',
      schoolName: 'Scuola Test',
      role: 'admin',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('email di verifica')
    // Verify rollback happened
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prisma.userTenant.deleteMany).toHaveBeenCalled()
    expect(prisma.user.delete).toHaveBeenCalled()
    expect(prisma.tenant.delete).toHaveBeenCalled()
  })
})
