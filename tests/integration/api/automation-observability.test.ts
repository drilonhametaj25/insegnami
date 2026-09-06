/**
 * Test per le route di osservabilità automazioni (3C2):
 * - GET /api/automation/runs: SUPERADMIN vista piattaforma; ADMIN vista
 *   filtrata al proprio tenant; ruoli non amministrativi → 403
 * - GET /api/automation/email-log: ADMIN filtrato tenantId; SUPERADMIN
 *   piattaforma; envelope {data, meta}
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
}))

jest.mock('@/lib/billing/features', () => ({
  hasFeature: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    automationRun: { findFirst: jest.fn(), findMany: jest.fn() },
    emailLog: { findMany: jest.fn(), count: jest.fn() },
  },
}))

jest.mock('@/lib/workers/heartbeat-status', () => ({
  readWorkerHeartbeat: jest.fn().mockResolvedValue({
    lastBeat: '2026-09-05T08:00:00.000Z',
    freshSeconds: 10,
    healthy: true,
  }),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET as getRuns } from '@/app/api/automation/runs/route'
import { GET as getEmailLog } from '@/app/api/automation/email-log/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

function makeRequest(url: string) {
  return {
    url: `http://localhost:3000${url}`,
    method: 'GET',
    headers: { get: () => null },
  } as any
}

function loginAs(role: string, tenantId = 'tenant-1') {
  getAuth.mockResolvedValue({
    user: { id: 'user-1', email: 'u@test.it', role, tenantId },
  })
}

describe('GET /api/automation/runs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.automationRun.findFirst.mockResolvedValue(null)
    prisma.automationRun.findMany.mockResolvedValue([])
  })

  it('TEACHER → 403', async () => {
    loginAs('TEACHER')
    const res = await getRuns(makeRequest('/api/automation/runs'))
    expect(res.status).toBe(403)
  })

  it('ADMIN → 200 con run filtrate sul proprio tenant e heartbeat incluso', async () => {
    loginAs('ADMIN', 'tenant-1')
    prisma.automationRun.findMany.mockResolvedValue([
      { id: 'r1', jobName: 'daily-automation', tenantId: 'tenant-1', startedAt: new Date(), finishedAt: new Date(), status: 'SUCCESS', error: null },
    ])

    const res = await getRuns(makeRequest('/api/automation/runs'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    )
    expect(json.meta.scope).toBe('tenant')
    expect(json.meta.workerHeartbeat.healthy).toBe(true)
    expect(json.data).toHaveLength(1)
  })

  it('SUPERADMIN → vista piattaforma senza filtro tenant', async () => {
    loginAs('SUPERADMIN')

    const res = await getRuns(makeRequest('/api/automation/runs'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    )
    expect(json.meta.scope).toBe('platform')
  })
})

describe('GET /api/automation/email-log', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.emailLog.findMany.mockResolvedValue([])
    prisma.emailLog.count.mockResolvedValue(0)
  })

  it('STUDENT → 403', async () => {
    loginAs('STUDENT')
    const res = await getEmailLog(makeRequest('/api/automation/email-log'))
    expect(res.status).toBe(403)
  })

  it('ADMIN → sempre filtrato sul proprio tenant, envelope {data, meta}', async () => {
    loginAs('ADMIN', 'tenant-1')
    prisma.emailLog.findMany.mockResolvedValue([
      { id: 'l1', to: 'a@test.it', subject: 'Sollecito', sourceType: 'payment-reminder', sourceId: 'p1:overdue', status: 'SENT', error: null, messageId: 'm1', sentAt: new Date(), createdAt: new Date() },
    ])
    prisma.emailLog.count.mockResolvedValue(1)

    const res = await getEmailLog(makeRequest('/api/automation/email-log?status=SENT'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', status: 'SENT' }),
      }),
    )
    expect(json.data).toHaveLength(1)
    expect(json.meta).toEqual(
      expect.objectContaining({ page: 1, total: 1, totalPages: 1 }),
    )
  })

  it('ADMIN non può forzare un altro tenant via query param', async () => {
    loginAs('ADMIN', 'tenant-1')

    await getEmailLog(makeRequest('/api/automation/email-log?tenantId=tenant-2'))

    expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    )
  })

  it('SUPERADMIN → piattaforma intera, con filtro opzionale tenantId', async () => {
    loginAs('SUPERADMIN')

    await getEmailLog(makeRequest('/api/automation/email-log?tenantId=tenant-2'))

    expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-2' }),
      }),
    )
  })
})
