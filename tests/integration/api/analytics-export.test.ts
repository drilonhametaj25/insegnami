/**
 * Test GET /api/analytics/export (Wave 2):
 * - ADMIN format=csv → 200 text/csv
 * - format diverso da csv → 400
 * - TEACHER → 403 (read:analytics non concesso dalla matrice)
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
    student: { count: jest.fn(), groupBy: jest.fn() },
    teacher: { count: jest.fn() },
    class: { count: jest.fn() },
    lesson: { count: jest.fn(), groupBy: jest.fn() },
    payment: { count: jest.fn(), aggregate: jest.fn() },
    attendance: { groupBy: jest.fn() },
  },
}))

import { GET } from '@/app/api/analytics/export/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function createRequest(qs: string) {
  return {
    url: `http://localhost:3000/api/analytics/export${qs}`,
    headers: { get: () => null },
  } as any
}

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

describe('GET /api/analytics/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.student.count.mockResolvedValue(10)
    prisma.teacher.count.mockResolvedValue(3)
    prisma.class.count.mockResolvedValue(4)
    prisma.lesson.count.mockResolvedValue(25)
    prisma.payment.count.mockResolvedValue(2)
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 1500 } })
    prisma.attendance.groupBy.mockResolvedValue([
      { status: 'PRESENT', _count: { status: 40 } },
      { status: 'ABSENT', _count: { status: 5 } },
    ])
  })

  it('ADMIN type=overview format=csv → 200 text/csv con i dati del tenant', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))

    const res = await GET(createRequest('?type=overview&period=30&format=csv'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')

    const csv = await res.text()
    expect(csv).toContain('Metrica,Valore')
    expect(csv).toContain('Studenti attivi,10')
    // scoping tenant su ogni query
    expect(prisma.student.count.mock.calls[0][0].where.tenantId).toBe('tenant-1')
  })

  it('type=attendance format=csv → 200 con righe per stato', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))

    const res = await GET(createRequest('?type=attendance&format=csv'))
    expect(res.status).toBe(200)

    const csv = await res.text()
    expect(csv).toContain('PRESENT,40')
    expect(csv).toContain('ABSENT,5')
  })

  it('format=xlsx → 400 (solo CSV)', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))

    const res = await GET(createRequest('?type=overview&format=xlsx'))
    expect(res.status).toBe(400)
  })

  it('format=pdf → 400 (solo CSV)', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))

    const res = await GET(createRequest('?type=overview&format=pdf'))
    expect(res.status).toBe(400)
  })

  it('TEACHER → 403 (permission read:analytics negata)', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))

    const res = await GET(createRequest('?type=overview&format=csv'))
    expect(res.status).toBe(403)
  })
})
