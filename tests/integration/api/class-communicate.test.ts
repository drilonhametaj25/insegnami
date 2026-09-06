/**
 * Test POST /api/classes/[id]/communicate (Wave 2):
 * - TEACHER titolare → 201, Message + recipients per gli studenti
 * - includeParents → aggiunge parentUserId e guardians
 * - TEACHER non titolare → 403
 * - STUDENT → 403
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  checkTenantAccess: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    teacher: { findFirst: jest.fn() },
    class: { findFirst: jest.fn() },
    message: { create: jest.fn() },
  },
}))

import { POST } from '@/app/api/classes/[id]/communicate/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest(body: any) {
  return {
    url: 'http://localhost:3000/api/classes/class-1/communicate',
    headers: { get: () => null },
    json: async () => body,
  } as any
}

const routeParams = { params: Promise.resolve({ id: 'class-1' }) }

function sessionFor(role: string) {
  return {
    user: {
      id: `user-${role.toLowerCase()}`,
      tenantId: 'tenant-1',
      role,
      email: `${role.toLowerCase()}@test.local`,
    },
  }
}

const baseClass = {
  id: 'class-1',
  tenantId: 'tenant-1',
  teacherId: 'teacher-1',
  students: [
    {
      student: {
        id: 'stu-1',
        userId: 'user-stu-1',
        parentUserId: 'user-parent-1',
        guardians: [{ userId: 'user-guardian-1' }],
      },
    },
    {
      student: {
        id: 'stu-2',
        userId: 'user-stu-2',
        parentUserId: null,
        guardians: [],
      },
    },
  ],
}

describe('POST /api/classes/[id]/communicate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.message.create.mockResolvedValue({
      id: 'msg-1',
      title: 'Avviso',
      _count: { recipients: 2 },
    })
  })

  it('TEACHER titolare → 201 con recipients = account studenti', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
    prisma.class.findFirst.mockResolvedValue(baseClass)

    const res = await POST(
      createRequest({ subject: 'Avviso', body: 'Testo avviso', includeParents: false }),
      routeParams
    )
    expect(res.status).toBe(201)

    const createArgs = prisma.message.create.mock.calls[0][0]
    expect(createArgs.data.title).toBe('Avviso')
    expect(createArgs.data.tenantId).toBe('tenant-1')
    expect(createArgs.data.senderId).toBe('user-teacher')

    const userIds = createArgs.data.recipients.create.map((r: any) => r.userId)
    expect(userIds).toEqual(expect.arrayContaining(['user-stu-1', 'user-stu-2']))
    expect(userIds).not.toContain('user-parent-1')
    expect(userIds).not.toContain('user-guardian-1')
  })

  it('includeParents:true → aggiunge tutore primario e guardians', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
    prisma.class.findFirst.mockResolvedValue(baseClass)

    const res = await POST(
      createRequest({ subject: 'Avviso', body: 'Testo avviso', includeParents: true }),
      routeParams
    )
    expect(res.status).toBe(201)

    const userIds = prisma.message.create.mock.calls[0][0].data.recipients.create.map(
      (r: any) => r.userId
    )
    expect(userIds).toEqual(
      expect.arrayContaining([
        'user-stu-1',
        'user-stu-2',
        'user-parent-1',
        'user-guardian-1',
      ])
    )
  })

  it('TEACHER non titolare → 403 e nessun Message creato', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-ALTRO' })
    prisma.class.findFirst.mockResolvedValue(baseClass)

    const res = await POST(
      createRequest({ subject: 'Avviso', body: 'Testo avviso' }),
      routeParams
    )
    expect(res.status).toBe(403)
    expect(prisma.message.create).not.toHaveBeenCalled()
  })

  it('STUDENT → 403 (fuori allow-list)', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT'))

    const res = await POST(
      createRequest({ subject: 'Avviso', body: 'Testo avviso' }),
      routeParams
    )
    expect(res.status).toBe(403)
  })

  it('body mancante → 400', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))
    prisma.class.findFirst.mockResolvedValue(baseClass)

    const res = await POST(createRequest({ subject: 'Solo oggetto' }), routeParams)
    expect(res.status).toBe(400)
    expect(prisma.message.create).not.toHaveBeenCalled()
  })
})
