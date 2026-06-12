/**
 * Hardening route materiali (C0.2):
 * (a)  DELETE classes/[id]/materials non deve seguire path traversal in material.url
 * (b)  POST classes/[id]/materials deve validare che lessonId appartenga a classe+tenant
 * (c)  POST lessons/[id]/materials deve validare type/size del file
 * (d)  POST lessons/[id]/materials deve rifiutare un TEACHER non titolare della lezione
 */
import { POST as postClassMaterial, DELETE as deleteClassMaterial } from '@/app/api/classes/[id]/materials/route'
import { POST as postLessonMaterial } from '@/app/api/lessons/[id]/materials/route'

// Mock auth (stesso pattern di crud.test.ts)
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock tenant guard (l'enforcement è testato in tenant-guard.test.ts)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock filesystem: i test non devono mai toccare il disco reale.
// NB: la transform SWC di next/jest riscrive gli import statici dei core
// module con il prefisso "node:", quindi vanno mockati ENTRAMBI gli
// specifier ("fs/promises" copre require/import dinamici).
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}))

// Mock helper titolarità teacher (la lookup reale è già scoped per tenant)
jest.mock('@/lib/api-auth', () => ({
  getTeacherIdForUser: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    class: { findFirst: jest.fn() },
    lesson: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    material: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    teacher: { findFirst: jest.fn() },
    student: { findFirst: jest.fn() },
  },
}))

const { getAuth } = require('@/lib/auth')
const { getTeacherIdForUser } = require('@/lib/api-auth')
const { prisma } = require('@/lib/db')
// Le route usano import statici → istanza "node:fs/promises"
const fsPromises = require('node:fs/promises')

// Request finto: implementa solo ciò che gli handler usano davvero
function createRequest({
  url = 'http://localhost:3000/api/test',
  formData,
  contentType,
}: {
  url?: string
  formData?: Record<string, any>
  contentType?: string
} = {}) {
  return {
    url,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType ?? null : null),
    },
    formData: () => Promise.resolve({ get: (key: string) => formData?.[key] ?? null }),
  } as any
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// File finto valido (PDF sotto il limite dei 10MB)
const validFile = {
  name: 'dispensa.pdf',
  type: 'application/pdf',
  size: 1024,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
}

const adminSession = {
  user: { id: 'user-1', email: 'admin@scuola.it', role: 'ADMIN', tenantId: 'tenant-1' },
}

beforeEach(() => {
  jest.clearAllMocks()
  getAuth.mockResolvedValue(adminSession)
})

describe('DELETE /api/classes/[id]/materials - path traversal', () => {
  it('(a) NON chiama fs.unlink quando material.url contiene path traversal', async () => {
    prisma.material.findFirst.mockResolvedValue({
      id: 'mat-1',
      tenantId: 'tenant-1',
      url: '/uploads/../../.env',
    })
    prisma.material.delete.mockResolvedValue({})

    const req = createRequest({
      url: 'http://localhost:3000/api/classes/class-1/materials?materialId=mat-1',
    })
    const response = await deleteClassMaterial(req, makeParams('class-1'))

    expect(response.status).toBe(200)
    // Il record va comunque eliminato, ma il filesystem non va toccato
    expect(prisma.material.delete).toHaveBeenCalled()
    expect(fsPromises.unlink).not.toHaveBeenCalled()
  })

  it('(a-bis) chiama fs.unlink per un path sicuro sotto public/uploads', async () => {
    prisma.material.findFirst.mockResolvedValue({
      id: 'mat-2',
      tenantId: 'tenant-1',
      url: '/uploads/materials/file.pdf',
    })
    prisma.material.delete.mockResolvedValue({})

    const req = createRequest({
      url: 'http://localhost:3000/api/classes/class-1/materials?materialId=mat-2',
    })
    const response = await deleteClassMaterial(req, makeParams('class-1'))

    expect(response.status).toBe(200)
    expect(fsPromises.unlink).toHaveBeenCalledTimes(1)
    const unlinkedPath = fsPromises.unlink.mock.calls[0][0] as string
    expect(unlinkedPath).toContain('uploads')
    expect(unlinkedPath).not.toContain('..')
  })
})

describe('POST /api/classes/[id]/materials - scoping lessonId', () => {
  it('(b) rifiuta con 400 un lessonId che non appartiene alla classe/tenant', async () => {
    prisma.class.findFirst.mockResolvedValue({
      id: 'class-1',
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
    })
    // La lezione indicata non esiste nella classe/tenant della sessione
    prisma.lesson.findFirst.mockResolvedValue(null)

    const req = createRequest({
      url: 'http://localhost:3000/api/classes/class-1/materials',
      formData: { file: validFile, name: 'Dispensa', lessonId: 'lesson-altro-tenant' },
    })
    const response = await postClassMaterial(req, makeParams('class-1'))

    expect(response.status).toBe(400)
    // La query deve essere scoped su classe E tenant della sessione
    expect(prisma.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'lesson-altro-tenant',
          classId: 'class-1',
          tenantId: 'tenant-1',
        }),
      })
    )
    expect(prisma.material.create).not.toHaveBeenCalled()
    // La validazione deve avvenire PRIMA della scrittura su disco (no file orfani)
    expect(fsPromises.writeFile).not.toHaveBeenCalled()
  })
})

describe('POST /api/lessons/[id]/materials - validazione file e titolarità', () => {
  it('(c) rifiuta con 400 un file di tipo non ammesso', async () => {
    prisma.lesson.findUnique.mockResolvedValue({
      id: 'lesson-1',
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
    })
    prisma.material.create.mockResolvedValue({ id: 'mat-x' })

    const badFile = {
      name: 'malware.exe',
      type: 'application/x-msdownload',
      size: 1024,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }
    const req = createRequest({
      contentType: 'multipart/form-data; boundary=x',
      formData: { file: badFile, name: 'File sospetto' },
    })
    const response = await postLessonMaterial(req, makeParams('lesson-1'))

    expect(response.status).toBe(400)
    expect(prisma.material.create).not.toHaveBeenCalled()
    expect(fsPromises.writeFile).not.toHaveBeenCalled()
  })

  it('(c-bis) rifiuta con 400 un file oltre il limite di 10MB', async () => {
    prisma.lesson.findUnique.mockResolvedValue({
      id: 'lesson-1',
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
    })
    prisma.material.create.mockResolvedValue({ id: 'mat-x' })

    const bigFile = {
      name: 'enorme.pdf',
      type: 'application/pdf',
      size: 11 * 1024 * 1024, // 11MB > 10MB
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }
    const req = createRequest({
      contentType: 'multipart/form-data; boundary=x',
      formData: { file: bigFile, name: 'File enorme' },
    })
    const response = await postLessonMaterial(req, makeParams('lesson-1'))

    expect(response.status).toBe(400)
    expect(prisma.material.create).not.toHaveBeenCalled()
    expect(fsPromises.writeFile).not.toHaveBeenCalled()
  })

  it('(d) rifiuta con 403 un TEACHER non titolare della lezione', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'user-2', email: 'teacher@scuola.it', role: 'TEACHER', tenantId: 'tenant-1' },
    })
    prisma.lesson.findUnique.mockResolvedValue({
      id: 'lesson-1',
      tenantId: 'tenant-1',
      teacherId: 'teacher-titolare',
    })
    prisma.material.create.mockResolvedValue({ id: 'mat-x' })
    // L'utente è un teacher del tenant, ma NON il titolare della lezione
    getTeacherIdForUser.mockResolvedValue('teacher-altro')

    const req = createRequest({
      contentType: 'multipart/form-data; boundary=x',
      formData: { file: validFile, name: 'Dispensa' },
    })
    const response = await postLessonMaterial(req, makeParams('lesson-1'))

    expect(response.status).toBe(403)
    expect(prisma.material.create).not.toHaveBeenCalled()
    expect(fsPromises.writeFile).not.toHaveBeenCalled()
  })
})
