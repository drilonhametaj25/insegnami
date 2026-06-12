import { POST as postGroup } from '@/app/api/messages/groups/route'

// Mock auth (stesso pattern di crud.test.ts)
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  canManage: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock tenant guard (l'enforcement è testato in tenant-guard.test.ts)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock api-auth (usato dal GET nello stesso modulo route)
jest.mock('@/lib/api-auth', () => ({
  getTeacherIdForUser: jest.fn().mockResolvedValue(null),
}))

// Mock Prisma: il client transazionale (tx) viene passato alla callback di $transaction
const txMock = {
  communicationGroup: {
    create: jest.fn(),
  },
  communicationGroupMember: {
    createMany: jest.fn(),
  },
}

jest.mock('@/lib/db', () => ({
  prisma: {
    userTenant: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    class: { findMany: jest.fn() },
    course: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest(body: any) {
  const req: any = {
    url: 'http://localhost:3000/api/messages/groups',
    method: 'POST',
    json: () => Promise.resolve(body),
  }
  return req
}

describe('POST /api/messages/groups', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'admin@scuola.it',
        role: 'ADMIN',
        tenantId: 'tenant-1',
      },
    })
    // $transaction esegue la callback passando il client transazionale mockato
    prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock))
  })

  it('crea il gruppo con i membri in transazione', async () => {
    // Tutti i memberIds appartengono al tenant
    prisma.userTenant.findMany.mockResolvedValue([
      { userId: 'u-a' },
      { userId: 'u-b' },
    ])
    txMock.communicationGroup.create.mockResolvedValue({
      id: 'group-1',
      tenantId: 'tenant-1',
      creatorId: 'user-1',
      name: 'Gruppo Docenti Piano',
      description: 'Coordinamento lezioni di piano',
      type: 'CUSTOM',
      createdAt: new Date('2026-06-12T10:00:00Z'),
    })
    txMock.communicationGroupMember.createMany.mockResolvedValue({ count: 2 })

    const req = createRequest({
      name: 'Gruppo Docenti Piano',
      description: 'Coordinamento lezioni di piano',
      memberIds: ['u-a', 'u-b'],
    })
    const response = await postGroup(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.group).toBeDefined()
    expect(data.group.id).toBe('group-1')
    expect(data.group.name).toBe('Gruppo Docenti Piano')
    expect(data.group.memberCount).toBe(2)

    // Verifica FK cross-tenant: la query è scopata sul tenant della sessione
    expect(prisma.userTenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: { in: ['u-a', 'u-b'] },
        }),
      })
    )

    // Creazione gruppo + membri dentro la transazione
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.communicationGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          creatorId: 'user-1',
          name: 'Gruppo Docenti Piano',
        }),
      })
    )
    expect(txMock.communicationGroupMember.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ groupId: 'group-1', userId: 'u-a' }),
          expect.objectContaining({ groupId: 'group-1', userId: 'u-b' }),
        ],
      })
    )
  })

  it('rifiuta con 400 se un memberId appartiene a un altro tenant (nessuna scrittura)', async () => {
    // Solo uno dei due id risulta nel tenant → l'altro è di un tenant diverso
    prisma.userTenant.findMany.mockResolvedValue([{ userId: 'u-a' }])

    const req = createRequest({
      name: 'Gruppo misto',
      memberIds: ['u-a', 'u-altro-tenant'],
    })
    const response = await postGroup(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/utenti non validi/i)

    // Nessuna scrittura deve essere avvenuta
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(txMock.communicationGroup.create).not.toHaveBeenCalled()
    expect(txMock.communicationGroupMember.createMany).not.toHaveBeenCalled()
  })

  it('rifiuta con 400 se il nome è troppo corto', async () => {
    const req = createRequest({
      name: 'A',
      memberIds: ['u-a'],
    })
    const response = await postGroup(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(prisma.userTenant.findMany).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rifiuta con 400 se memberIds è vuoto', async () => {
    const req = createRequest({
      name: 'Gruppo valido',
      memberIds: [],
    })
    const response = await postGroup(req)

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('ritorna 401 se non autenticato', async () => {
    getAuth.mockResolvedValue(null)

    const req = createRequest({
      name: 'Gruppo valido',
      memberIds: ['u-a'],
    })
    const response = await postGroup(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Non autorizzato')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('ritorna 403 per ruolo non abilitato (STUDENT)', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'user-2', role: 'STUDENT', tenantId: 'tenant-1' },
    })

    const req = createRequest({
      name: 'Gruppo valido',
      memberIds: ['u-a'],
    })
    const response = await postGroup(req)

    expect(response.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
