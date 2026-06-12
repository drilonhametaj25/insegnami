import { GET as exportAttendance } from '@/app/api/attendance/export/route'

// Polyfill minimale di Response per l'ambiente jsdom dei test
// (la route restituisce il CSV con `new Response(...)`)
if (typeof (global as any).Response === 'undefined') {
  ;(global as any).Response = class {
    body: any
    status: number
    headers: Map<string, string>

    constructor(body: any, init?: any) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = new Map(Object.entries(init?.headers || {}))
    }

    text() {
      return Promise.resolve(String(this.body))
    }
  }
}

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  isAdminRole: (role: string) => ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role),
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
}))

// Mock tenant guard (l'enforcement è testato in tenant-guard.test.ts)
jest.mock('@/lib/tenant-guard', () => ({
  blockIfTenantInaccessible: jest.fn().mockResolvedValue(null),
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    attendance: {
      findMany: jest.fn(),
    },
  },
}))

const { getAuth } = require('@/lib/auth')
const { prisma } = require('@/lib/db')

const PARENT_EMAIL = 'genitore.rossi@test.it'
const PARENT_PHONE = '+393331112233'

// Shape coerente con l'include della query nella route
// (student.user, student.parentUser, lesson.class.course, lesson.teacher)
const mockAttendanceRecords = [
  {
    id: 'att-1',
    status: 'PRESENT',
    notes: 'Tutto ok',
    createdAt: new Date('2026-01-10T10:00:00Z'),
    student: {
      studentCode: 'S001',
      user: {
        firstName: 'Marco',
        lastName: 'Bianchi',
        email: 'marco@test.it',
      },
      parentUser: {
        firstName: 'Paolo',
        lastName: 'Rossi',
        email: PARENT_EMAIL,
        phone: PARENT_PHONE,
      },
    },
    lesson: {
      startTime: new Date('2026-01-10T09:00:00Z'),
      title: 'Lezione di solfeggio',
      class: {
        name: 'Classe A',
        code: 'A1',
        course: { name: 'Corso Piano' },
      },
      teacher: { firstName: 'Anna', lastName: 'Neri' },
    },
  },
  {
    id: 'att-2',
    status: 'ABSENT',
    notes: null,
    createdAt: new Date('2026-01-11T10:00:00Z'),
    student: {
      studentCode: 'S002',
      user: {
        firstName: 'Giulia',
        lastName: 'Verdi',
        email: 'giulia@test.it',
      },
      parentUser: null, // studente senza genitore collegato
    },
    lesson: {
      startTime: new Date('2026-01-11T09:00:00Z'),
      title: 'Lezione di piano',
      class: {
        name: 'Classe A',
        code: 'A1',
        course: { name: 'Corso Piano' },
      },
      teacher: { firstName: 'Anna', lastName: 'Neri' },
    },
  },
]

function createRequest(url: string) {
  return { url, method: 'GET' } as any
}

// Estrae il CSV dal Response e rimuove il BOM UTF-8 per i confronti
async function readCsv(response: any): Promise<string> {
  const text = await response.text()
  return text.replace(/^﻿/, '')
}

// Conta le colonne di una riga CSV ignorando le virgole dentro i campi quotati
function countCsvColumns(line: string): number {
  let count = 1
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ',' && !inQuotes) count++
  }
  return count
}

describe('GET /api/attendance/export - PII genitori gated per ruolo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.attendance.findMany.mockResolvedValue(mockAttendanceRecords)
  })

  it('ADMIN: il CSV include le colonne contatti del genitore', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-1' },
    })

    const response = await exportAttendance(
      createRequest('http://localhost:3000/api/attendance/export?format=csv')
    )
    expect(response.status).toBe(200)

    const csv = await readCsv(response)
    const [header] = csv.split('\n')

    // Header con le colonne PII del genitore
    expect(header).toContain('Parent Email')
    expect(header).toContain('Parent Phone')

    // I valori dei contatti sono presenti nelle righe
    expect(csv).toContain(PARENT_EMAIL)
    expect(csv).toContain(PARENT_PHONE)
  })

  it('TEACHER: il CSV non contiene né header né valori dei contatti genitore', async () => {
    getAuth.mockResolvedValue({
      user: { id: 'user-2', role: 'TEACHER', tenantId: 'tenant-1' },
    })

    const response = await exportAttendance(
      createRequest('http://localhost:3000/api/attendance/export?format=csv')
    )
    expect(response.status).toBe(200)

    const csv = await readCsv(response)
    const [header, ...rows] = csv.split('\n')

    // Niente colonne PII nell'header
    expect(header).not.toContain('Parent Email')
    expect(header).not.toContain('Parent Phone')

    // Nessuna riga espone email/telefono del genitore
    expect(csv).not.toContain(PARENT_EMAIL)
    expect(csv).not.toContain(PARENT_PHONE)

    // Coerenza header/righe: stesso numero di colonne
    const headerCols = countCsvColumns(header)
    for (const row of rows) {
      expect(countCsvColumns(row)).toBe(headerCols)
    }
  })
})
