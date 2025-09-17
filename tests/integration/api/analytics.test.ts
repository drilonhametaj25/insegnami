import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/analytics/route'

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve({
    user: {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ADMIN',
    }
  }))
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    student: {
      count: jest.fn(),
    },
    teacher: {
      count: jest.fn(),
    },
    class: {
      count: jest.fn(),
    },
    lesson: {
      count: jest.fn(),
    },
    payment: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    attendance: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}))

describe('/api/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/analytics', () => {
    it('returns overview stats successfully', async () => {
      const { prisma } = require('@/lib/db')
      
      // Mock Prisma responses
      prisma.student.count.mockResolvedValue(150)
      prisma.teacher.count.mockResolvedValue(25)
      prisma.class.count.mockResolvedValue(12)
      prisma.lesson.count.mockResolvedValue(45)
      prisma.payment.count.mockResolvedValue(3)
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 15000 } })
      prisma.attendance.count
        .mockResolvedValueOnce(120) // present
        .mockResolvedValueOnce(140) // total

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?type=overview&period=30',
      })

      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('totalStudents', 150)
      expect(data).toHaveProperty('totalTeachers', 25)
      expect(data).toHaveProperty('totalClasses', 12)
      expect(data).toHaveProperty('totalLessons', 45)
      expect(data).toHaveProperty('overduePayments', 3)
      expect(data).toHaveProperty('totalRevenue', 15000)
      expect(data).toHaveProperty('attendanceRate')
    })

    it('returns attendance stats successfully', async () => {
      const { prisma } = require('@/lib/db')
      
      // Mock attendance groupBy responses
      prisma.attendance.groupBy
        .mockResolvedValueOnce([
          { status: 'PRESENT', _count: { status: 120 } },
          { status: 'ABSENT', _count: { status: 15 } },
        ])
        .mockResolvedValueOnce([
          { createdAt: new Date('2024-01-01'), _count: { id: 25 } },
          { createdAt: new Date('2024-01-02'), _count: { id: 28 } },
        ])

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?type=attendance&period=30',
      })

      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('byStatus')
      expect(data).toHaveProperty('daily')
      expect(data).toHaveProperty('totalRecords')
      expect(data.byStatus).toHaveLength(2)
    })

    it('returns 401 when not authenticated', async () => {
      const { auth } = require('@/lib/auth')
      auth.mockResolvedValueOnce(null)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?type=overview',
      })

      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })

    it('handles invalid type parameter', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?type=invalid',
      })

      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Invalid type')
    })

    it('uses default period when not specified', async () => {
      const { prisma } = require('@/lib/db')
      
      prisma.student.count.mockResolvedValue(100)
      prisma.teacher.count.mockResolvedValue(20)
      prisma.class.count.mockResolvedValue(10)
      prisma.lesson.count.mockResolvedValue(30)
      prisma.payment.count.mockResolvedValue(2)
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 10000 } })
      prisma.attendance.count.mockResolvedValue(80).mockResolvedValue(100)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics', // No period specified
      })

      const response = await GET(req as any)
      
      expect(response.status).toBe(200)
      // Should use default period of 30 days
    })
  })
})
