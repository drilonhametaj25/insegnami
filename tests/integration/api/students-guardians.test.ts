/**
 * Wave 2 — Gestione tutori (StudentGuardian).
 *
 * Contratto:
 *  - POST /api/students con genitore collegato scrive ANCHE la riga
 *    StudentGuardian (isPrimary true) oltre a parentUserId.
 *  - PUT /api/students/[id] con guardians[] sincronizza la tabella ponte in
 *    transazione (delete dei rimossi, upsert dei presenti, parentUserId =
 *    tutore primario).
 *  - GET /api/students/[id] per PARENT è guardian-aware: accesso concesso
 *    anche senza parentUserId se esiste la riga StudentGuardian.
 *
 * Pattern mock: vedi crud.test.ts / payment-receipt.test.ts.
 */
import { POST as postStudent } from '@/app/api/students/route'
import { GET as getStudent, PUT as putStudent } from '@/app/api/students/[id]/route'

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/plan-limits', () => ({
  checkStudentLimit: jest.fn(() => Promise.resolve({ allowed: true })),
}))

// Limiti effettivi illimitati: il guard anti-bypass sulla riattivazione
// (PUT status→ACTIVE) è testato in plan-limit-bulk.test.ts
jest.mock('@/lib/billing/limits', () => ({
  getEffectiveLimits: jest.fn().mockResolvedValue({
    maxStudents: null,
    maxTeachers: null,
    maxClasses: null,
    storageBytes: null,
    planSlug: null,
    addonExtras: { students: 0, teachers: 0, classes: 0, storageGb: 0 },
  }),
  getStorageUsedBytes: jest.fn().mockResolvedValue(0),
}))

jest.mock('@/lib/api-middleware', () => ({
  getPublicErrorMessage: (_err: any, fallback: string) => fallback,
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}))

// TransactionClient esposto da $transaction nella PUT
const mockTx = {
  user: {
    update: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  userTenant: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  student: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
  studentGuardian: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
}

jest.mock('@/lib/db', () => ({
  prisma: {
    student: {
      findFirst: jest.fn(),
      findUnique: jest.fn(), // lookup anti-collisione del generatore codici
      count: jest.fn(),
      create: jest.fn(),
    },
    studentGuardian: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userTenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn(mockTx)),
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

const adminSession = {
  user: { id: 'user-admin', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

const parentSession = {
  user: { id: 'user-parent', email: 'parent@test.it', role: 'PARENT', tenantId: 'tenant-1' },
}

function createRequest(url: string, method: string, body?: any) {
  return {
    url: `http://localhost${url}`,
    method,
    json: body ? () => Promise.resolve(body) : undefined,
    headers: { get: jest.fn(() => null) },
  } as any
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  getAuth.mockResolvedValue(adminSession)
})

describe('POST /api/students — scrittura StudentGuardian', () => {
  it('con genitore esistente crea la riga StudentGuardian isPrimary', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-parent', email: 'parent@test.it' })
    prisma.user.create.mockResolvedValue({ id: 'u-student', email: 'shadow@tenant-1.local' })
    prisma.userTenant.findUnique.mockResolvedValue({ id: 'ut-1' })
    prisma.userTenant.create.mockResolvedValue({ id: 'ut-2' })
    prisma.student.count.mockResolvedValue(0)
    prisma.student.create.mockResolvedValue({
      id: 's-new',
      firstName: 'Luca',
      lastName: 'Verdi',
      parentUser: { id: 'user-parent', firstName: 'Paola', lastName: 'Rossi', email: 'parent@test.it', phone: null },
      user: null,
    })
    prisma.studentGuardian.create.mockResolvedValue({ id: 'sg-1' })

    const res = await postStudent(
      createRequest('/api/students', 'POST', {
        firstName: 'Luca',
        lastName: 'Verdi',
        hasParent: true,
        parentType: 'existing',
        existingParentId: 'user-parent',
      })
    )

    expect(res.status).toBe(201)
    expect(prisma.studentGuardian.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        studentId: 's-new',
        userId: 'user-parent',
        isPrimary: true,
      },
    })
  })

  it('senza genitore non scrive StudentGuardian', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({ id: 'u-student', email: 'shadow@tenant-1.local' })
    prisma.userTenant.create.mockResolvedValue({ id: 'ut-1' })
    prisma.student.count.mockResolvedValue(0)
    prisma.student.create.mockResolvedValue({
      id: 's-new',
      firstName: 'Luca',
      lastName: 'Verdi',
      parentUser: null,
      user: null,
    })

    const res = await postStudent(
      createRequest('/api/students', 'POST', { firstName: 'Luca', lastName: 'Verdi' })
    )

    expect(res.status).toBe(201)
    expect(prisma.studentGuardian.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/students/[id] — sync guardians[]', () => {
  const existingStudent = {
    id: 's1',
    tenantId: 'tenant-1',
    firstName: 'Luca',
    lastName: 'Verdi',
    dateOfBirth: new Date('2010-01-01'),
    user: null,
    parentUser: null,
  }

  beforeEach(() => {
    prisma.student.findFirst.mockResolvedValue(existingStudent)
    mockTx.user.findMany.mockResolvedValue([{ id: 'user-g1' }, { id: 'user-g2' }])
    mockTx.studentGuardian.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.studentGuardian.upsert.mockResolvedValue({ id: 'sg-x' })
    mockTx.student.update.mockResolvedValue({
      ...existingStudent,
      parentUser: { id: 'user-g1', firstName: 'Paola', lastName: 'Rossi', email: 'g1@test.it', phone: null },
      guardians: [],
    })
  })

  it('sincronizza la tabella ponte e denormalizza il primario su parentUserId', async () => {
    const res = await putStudent(
      createRequest('/api/students/s1', 'PUT', {
        firstName: 'Luca',
        lastName: 'Verdi',
        guardians: [
          { userId: 'user-g1', relationship: 'madre', isPrimary: true },
          { userId: 'user-g2', relationship: 'padre', isPrimary: false },
        ],
      }),
      routeParams('s1')
    )

    expect(res.status).toBe(200)

    // Delete dei tutori non più presenti
    expect(mockTx.studentGuardian.deleteMany).toHaveBeenCalledWith({
      where: {
        studentId: 's1',
        userId: { notIn: ['user-g1', 'user-g2'] },
      },
    })

    // Upsert per ciascun tutore
    expect(mockTx.studentGuardian.upsert).toHaveBeenCalledTimes(2)
    expect(mockTx.studentGuardian.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_userId: { studentId: 's1', userId: 'user-g1' } },
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          relationship: 'madre',
          isPrimary: true,
        }),
      })
    )

    // parentUserId = tutore primario
    expect(mockTx.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: { parentUserId: 'user-g1' },
      })
    )
  })

  it('guardians[] vuoto svuota la ponte e azzera parentUserId', async () => {
    const res = await putStudent(
      createRequest('/api/students/s1', 'PUT', {
        firstName: 'Luca',
        lastName: 'Verdi',
        guardians: [],
      }),
      routeParams('s1')
    )

    expect(res.status).toBe(200)
    expect(mockTx.studentGuardian.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 's1', userId: { notIn: [] } },
    })
    expect(mockTx.studentGuardian.upsert).not.toHaveBeenCalled()
    expect(mockTx.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { parentUserId: null } })
    )
  })

  it('rifiuta tutori estranei al tenant', async () => {
    mockTx.user.findMany.mockResolvedValue([]) // nessun utente valido nel tenant

    const res = await putStudent(
      createRequest('/api/students/s1', 'PUT', {
        firstName: 'Luca',
        lastName: 'Verdi',
        guardians: [{ userId: 'user-intruso', isPrimary: true }],
      }),
      routeParams('s1')
    )

    expect(res.status).toBe(500)
    expect(mockTx.studentGuardian.upsert).not.toHaveBeenCalled()
  })
})

describe('GET /api/students/[id] — ownership genitore guardian-aware', () => {
  const baseStudent = {
    id: 's1',
    tenantId: 'tenant-1',
    studentCode: 'S001',
    firstName: 'Luca',
    lastName: 'Verdi',
    email: null,
    phone: null,
    dateOfBirth: new Date('2010-01-01'),
    address: null,
    emergencyContact: null,
    medicalNotes: null,
    specialNeeds: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null,
    parentUser: null,
    tenant: { id: 'tenant-1', name: 'Scuola Test' },
    classes: [],
  }

  it('concede accesso al tutore presente in StudentGuardian anche senza parentUserId', async () => {
    getAuth.mockResolvedValue(parentSession)
    prisma.student.findFirst.mockResolvedValue({
      ...baseStudent,
      parentUserId: 'user-altro',
      guardians: [
        {
          id: 'sg-1',
          userId: 'user-parent',
          relationship: 'madre',
          isPrimary: false,
          user: { id: 'user-parent', firstName: 'Paola', lastName: 'Rossi', email: 'parent@test.it', phone: null },
        },
      ],
    })

    const res = await getStudent(createRequest('/api/students/s1', 'GET'), routeParams('s1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.student.guardians).toHaveLength(1)
    expect(body.student.guardians[0]).toMatchObject({
      userId: 'user-parent',
      relationship: 'madre',
    })
  })

  it('nega accesso al genitore non collegato allo studente', async () => {
    getAuth.mockResolvedValue(parentSession)
    prisma.student.findFirst.mockResolvedValue({
      ...baseStudent,
      parentUserId: 'user-altro',
      guardians: [],
    })

    const res = await getStudent(createRequest('/api/students/s1', 'GET'), routeParams('s1'))
    expect(res.status).toBe(403)
  })
})
