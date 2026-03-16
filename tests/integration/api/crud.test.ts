import { GET as getStudents, POST as postStudent } from '@/app/api/students/route'
import { GET as getTeachers, POST as postTeacher } from '@/app/api/teachers/route'

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
}))

// Mock plan limits
jest.mock('@/lib/plan-limits', () => ({
  checkStudentLimit: jest.fn(() => Promise.resolve({ allowed: true })),
  checkTeacherLimit: jest.fn(() => Promise.resolve({ allowed: true })),
}))

jest.mock('@/lib/api-middleware', () => ({
  getPublicErrorMessage: (err: any) => 'Internal server error',
}))

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    student: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    teacher: {
      findMany: jest.fn(),
      count: jest.fn(),
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
  },
}))

const { getAuth } = require('@/lib/auth')
const { checkStudentLimit, checkTeacherLimit } = require('@/lib/plan-limits')
const { prisma } = require('@/lib/db')

function createRequest(url: string, body?: any) {
  const req: any = {
    url,
    method: body ? 'POST' : 'GET',
    json: body ? () => Promise.resolve(body) : undefined,
  }
  return req
}

describe('CRUD - Students API', () => {
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
  })

  describe('GET /api/students', () => {
    it('returns paginated students scoped to tenant', async () => {
      const mockStudents = [
        {
          id: 's1',
          firstName: 'Marco',
          lastName: 'Bianchi',
          studentCode: 'S001',
          email: 'marco@test.it',
          phone: null,
          dateOfBirth: null,
          address: null,
          emergencyContact: null,
          medicalNotes: null,
          specialNeeds: null,
          status: 'ACTIVE',
          enrollmentDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          classes: [],
          tenant: { id: 'tenant-1', name: 'Scuola Test' },
          parentUser: null,
          user: null,
        },
      ]
      prisma.student.findMany.mockResolvedValue(mockStudents)
      prisma.student.count.mockResolvedValue(1)

      const req = createRequest('http://localhost:3000/api/students?page=1&limit=10')
      const response = await getStudents(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.students).toHaveLength(1)
      expect(data.pagination.total).toBe(1)
      // Verify tenant scoping was applied
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        })
      )
    })

    it('returns 401 when not authenticated', async () => {
      getAuth.mockResolvedValue(null)

      const req = createRequest('http://localhost:3000/api/students?page=1&limit=10')
      const response = await getStudents(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 403 for unauthorized role (STUDENT)', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'user-2', role: 'STUDENT', tenantId: 'tenant-1' },
      })

      const req = createRequest('http://localhost:3000/api/students?page=1&limit=10')
      const response = await getStudents(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })

  describe('POST /api/students', () => {
    it('creates a student with required fields', async () => {
      prisma.student.count.mockResolvedValue(5)
      prisma.student.create.mockResolvedValue({
        id: 's-new',
        firstName: 'Luca',
        lastName: 'Verdi',
        studentCode: 'S006',
        tenantId: 'tenant-1',
        classes: [],
        parentUser: null,
        user: null,
      })

      const req = createRequest('http://localhost:3000/api/students', {
        firstName: 'Luca',
        lastName: 'Verdi',
      })
      const response = await postStudent(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.student).toBeDefined()
    })

    it('rejects when plan limit is reached', async () => {
      checkStudentLimit.mockResolvedValue({
        allowed: false,
        message: 'Limite studenti raggiunto',
        current: 50,
        limit: 50,
      })

      const req = createRequest('http://localhost:3000/api/students', {
        firstName: 'Luca',
        lastName: 'Verdi',
      })
      const response = await postStudent(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.limitReached).toBe(true)
    })

    it('returns 403 for cross-tenant access (non-admin role)', async () => {
      getAuth.mockResolvedValue({
        user: { id: 'user-2', role: 'TEACHER', tenantId: 'tenant-2' },
      })

      const req = createRequest('http://localhost:3000/api/students', {
        firstName: 'Luca',
        lastName: 'Verdi',
      })
      const response = await postStudent(req)
      const data = await response.json()

      // TEACHER cannot create students
      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })
})

describe('CRUD - Teachers API', () => {
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
  })

  describe('GET /api/teachers', () => {
    it('returns paginated teachers scoped to tenant', async () => {
      prisma.teacher.findMany.mockResolvedValue([
        {
          id: 't1',
          firstName: 'Anna',
          lastName: 'Neri',
          teacherCode: 'T001',
          email: 'anna@test.it',
          specialization: 'Piano',
          status: 'ACTIVE',
          classes: [],
          tenant: { id: 'tenant-1', name: 'Scuola Test' },
        },
      ])
      prisma.teacher.count.mockResolvedValue(1)

      const req = createRequest('http://localhost:3000/api/teachers?page=1&limit=10')
      const response = await getTeachers(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.teachers).toBeDefined()
      expect(prisma.teacher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        })
      )
    })

    it('returns 401 when not authenticated', async () => {
      getAuth.mockResolvedValue(null)

      const req = createRequest('http://localhost:3000/api/teachers?page=1&limit=10')
      const response = await getTeachers(req)
      const data = await response.json()

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/teachers', () => {
    it('rejects when teacher plan limit is reached', async () => {
      checkTeacherLimit.mockResolvedValue({
        allowed: false,
        message: 'Limite insegnanti raggiunto',
        current: 10,
        limit: 10,
      })

      const req = createRequest('http://localhost:3000/api/teachers', {
        firstName: 'Paolo',
        lastName: 'Verdi',
        email: 'paolo@test.it',
      })
      const response = await postTeacher(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.limitReached).toBe(true)
    })
  })
})
