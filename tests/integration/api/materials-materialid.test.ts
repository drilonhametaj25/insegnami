/**
 * Test route REST materiali per id (Wave 2):
 * - PATCH /api/classes/[id]/materials/[materialId]: TEACHER titolare 200,
 *   TEACHER non titolare 403
 * - PATCH /api/lessons/[id]/materials/[materialId]: ownership su lesson.teacherId
 * - DELETE classes: record eliminato, unlink solo su path sicuro
 */

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  checkTenantAccess: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}))

// Mai toccare il disco reale (entrambi gli specifier: la transform SWC
// riscrive gli import statici col prefisso node:)
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('x')),
  unlink: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('node:fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('x')),
  unlink: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    teacher: { findFirst: jest.fn() },
    material: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    studentClass: { findFirst: jest.fn() },
  },
}))

import { PATCH as patchClassMaterial, DELETE as deleteClassMaterial } from '@/app/api/classes/[id]/materials/[materialId]/route'
import { PATCH as patchLessonMaterial } from '@/app/api/lessons/[id]/materials/[materialId]/route'

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')
const fsPromises = require('node:fs/promises')

function createRequest(body: any = {}, url = 'http://localhost:3000/api/test') {
  return {
    url,
    headers: { get: () => null },
    json: async () => body,
  } as any
}

const classParams = { params: Promise.resolve({ id: 'class-1', materialId: 'mat-1' }) }
const lessonParams = { params: Promise.resolve({ id: 'lesson-1', materialId: 'mat-1' }) }

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

const classMaterial = {
  id: 'mat-1',
  tenantId: 'tenant-1',
  name: 'Dispensa',
  url: '/uploads/materials/file.pdf',
  mimeType: 'application/pdf',
  lesson: {
    id: 'lesson-1',
    classId: 'class-1',
    class: { id: 'class-1', teacherId: 'teacher-1' },
  },
}

const lessonMaterial = {
  id: 'mat-1',
  tenantId: 'tenant-1',
  name: 'Dispensa',
  url: '/uploads/lessons/lesson-1/file.pdf',
  mimeType: 'application/pdf',
  lesson: { id: 'lesson-1', classId: 'class-1', teacherId: 'teacher-1' },
}

describe('PATCH /api/classes/[id]/materials/[materialId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.material.update.mockResolvedValue({ ...classMaterial, name: 'Nuovo nome' })
  })

  it('TEACHER titolare della classe → 200', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
    prisma.material.findFirst.mockResolvedValue(classMaterial)

    const res = await patchClassMaterial(
      createRequest({ name: 'Nuovo nome', description: 'desc' }),
      classParams
    )
    expect(res.status).toBe(200)
    expect(prisma.material.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mat-1' },
        data: expect.objectContaining({ name: 'Nuovo nome' }),
      })
    )
  })

  it('TEACHER non titolare → 403 e nessun update', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-ALTRO' })
    prisma.material.findFirst.mockResolvedValue(classMaterial)

    const res = await patchClassMaterial(createRequest({ name: 'X' }), classParams)
    expect(res.status).toBe(403)
    expect(prisma.material.update).not.toHaveBeenCalled()
  })

  it('STUDENT → 403 (fuori allow-list)', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT'))

    const res = await patchClassMaterial(createRequest({ name: 'X' }), classParams)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/lessons/[id]/materials/[materialId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.material.update.mockResolvedValue({ ...lessonMaterial, name: 'Nuovo' })
  })

  it('TEACHER titolare della lezione → 200', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' })
    prisma.material.findFirst.mockResolvedValue(lessonMaterial)

    const res = await patchLessonMaterial(createRequest({ name: 'Nuovo' }), lessonParams)
    expect(res.status).toBe(200)
  })

  it('TEACHER non titolare → 403', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'))
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-ALTRO' })
    prisma.material.findFirst.mockResolvedValue(lessonMaterial)

    const res = await patchLessonMaterial(createRequest({ name: 'Nuovo' }), lessonParams)
    expect(res.status).toBe(403)
    expect(prisma.material.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/classes/[id]/materials/[materialId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.material.delete.mockResolvedValue({})
  })

  it('ADMIN → 200: record eliminato e unlink su path sicuro', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))
    prisma.material.findFirst.mockResolvedValue(classMaterial)

    const res = await deleteClassMaterial(createRequest(), classParams)
    expect(res.status).toBe(200)
    expect(prisma.material.delete).toHaveBeenCalledWith({ where: { id: 'mat-1' } })
    expect(fsPromises.unlink).toHaveBeenCalledTimes(1)
  })

  it('url con path traversal → record eliminato ma NESSUN unlink', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'))
    prisma.material.findFirst.mockResolvedValue({
      ...classMaterial,
      url: '/uploads/../../.env',
    })

    const res = await deleteClassMaterial(createRequest(), classParams)
    expect(res.status).toBe(200)
    expect(prisma.material.delete).toHaveBeenCalled()
    expect(fsPromises.unlink).not.toHaveBeenCalled()
  })
})
