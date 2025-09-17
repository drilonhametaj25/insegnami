import { describe, it, expect } from '@jest/globals'

// Mock utility functions for testing
const formatCurrency = (amount: number, currency = 'EUR'): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
  }).format(amount)
}

const formatDate = (date: string | Date, locale = 'it-IT'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString(locale)
}

const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const generateStudentCode = (firstName: string, lastName: string, year: number): string => {
  const firstInitial = firstName.charAt(0).toUpperCase()
  const lastInitial = lastName.charAt(0).toUpperCase()
  const yearShort = year.toString().slice(-2)
  const randomNum = Math.floor(Math.random() * 999) + 1
  return `${firstInitial}${lastInitial}${yearShort}${randomNum.toString().padStart(3, '0')}`
}

const calculateAttendanceRate = (present: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((present / total) * 100 * 10) / 10
}

const isValidPhoneNumber = (phone: string): boolean => {
  // Italian phone number regex (simplified)
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats currency correctly in EUR', () => {
      const result = formatCurrency(1234.56)
      expect(result).toMatch(/1234,56.*€/)
      expect(result).toContain('€')
      expect(result).toContain('1234,56')
    })

    it('formats currency with different amounts', () => {
      expect(formatCurrency(0)).toMatch(/0,00.*€/)
      expect(formatCurrency(10)).toMatch(/10,00.*€/)
      expect(formatCurrency(999.99)).toMatch(/999,99.*€/)
    })

    it('handles negative amounts', () => {
      const result = formatCurrency(-500)
      expect(result).toContain('-')
      expect(result).toContain('500,00')
      expect(result).toContain('€')
    })
  })

  describe('formatDate', () => {
    it('formats date string correctly', () => {
      const date = '2024-01-15'
      const formatted = formatDate(date)
      expect(formatted).toBe('15/01/2024')
    })

    it('formats Date object correctly', () => {
      const date = new Date('2024-12-25')
      const formatted = formatDate(date)
      expect(formatted).toBe('25/12/2024')
    })
  })

  describe('formatPercentage', () => {
    it('formats percentage with default decimals', () => {
      expect(formatPercentage(87.5)).toBe('87.5%')
      expect(formatPercentage(100)).toBe('100.0%')
    })

    it('formats percentage with custom decimals', () => {
      expect(formatPercentage(87.123, 2)).toBe('87.12%')
      expect(formatPercentage(87.999, 0)).toBe('88%')
    })
  })

  describe('validateEmail', () => {
    it('validates correct email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true)
      expect(validateEmail('test.email@domain.org')).toBe(true)
      expect(validateEmail('student@school.edu')).toBe(true)
    })

    it('rejects invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user space@domain.com')).toBe(false)
    })
  })

  describe('generateStudentCode', () => {
    // Mock Math.random for consistent testing
    const mockRandom = jest.spyOn(Math, 'random')

    afterEach(() => {
      mockRandom.mockRestore()
    })

    it('generates student code with correct format', () => {
      mockRandom.mockReturnValue(0.5) // Always returns 500 when * 999 + 1
      const code = generateStudentCode('Mario', 'Rossi', 2024)
      expect(code).toMatch(/^MR24\d{3}$/) // MR24 followed by 3 digits
      expect(code.length).toBe(7)
    })

    it('handles different names and years', () => {
      const code1 = generateStudentCode('Anna', 'Verdi', 2023)
      expect(code1).toMatch(/^AV23\d{3}$/)
      
      const code2 = generateStudentCode('Luigi', 'Bianchi', 2025)
      expect(code2).toMatch(/^LB25\d{3}$/)
    })

    it('uses uppercase initials', () => {
      const code = generateStudentCode('mario', 'rossi', 2024)
      expect(code).toMatch(/^MR24\d{3}$/)
    })
  })

  describe('calculateAttendanceRate', () => {
    it('calculates attendance rate correctly', () => {
      expect(calculateAttendanceRate(18, 20)).toBe(90.0)
      expect(calculateAttendanceRate(15, 20)).toBe(75.0)
      expect(calculateAttendanceRate(20, 20)).toBe(100.0)
    })

    it('handles edge cases', () => {
      expect(calculateAttendanceRate(0, 0)).toBe(0)
      expect(calculateAttendanceRate(0, 10)).toBe(0)
      expect(calculateAttendanceRate(5, 3)).toBe(166.7) // Over 100% possible
    })

    it('rounds to one decimal place', () => {
      expect(calculateAttendanceRate(1, 3)).toBe(33.3)
      expect(calculateAttendanceRate(2, 3)).toBe(66.7)
    })
  })

  describe('isValidPhoneNumber', () => {
    it('validates correct phone numbers', () => {
      expect(isValidPhoneNumber('+39123456789')).toBe(true)
      expect(isValidPhoneNumber('123456789')).toBe(true)
      expect(isValidPhoneNumber('+1234567890123')).toBe(true)
    })

    it('handles formatted phone numbers', () => {
      expect(isValidPhoneNumber('+39 123 456 789')).toBe(true)
      expect(isValidPhoneNumber('(123) 456-7890')).toBe(true)
    })

    it('rejects invalid phone numbers', () => {
      expect(isValidPhoneNumber('')).toBe(false)
      expect(isValidPhoneNumber('0123456789')).toBe(false) // Starts with 0
      expect(isValidPhoneNumber('abc')).toBe(false)
      expect(isValidPhoneNumber('12345678901234567')).toBe(false) // Too long
    })
  })

  describe('truncateText', () => {
    it('truncates long text correctly', () => {
      const longText = 'This is a very long text that should be truncated'
      expect(truncateText(longText, 20)).toBe('This is a very lo...')
    })

    it('does not truncate short text', () => {
      const shortText = 'Short text'
      expect(truncateText(shortText, 20)).toBe('Short text')
    })

    it('handles edge cases', () => {
      expect(truncateText('', 10)).toBe('')
      expect(truncateText('Hello', 5)).toBe('Hello')
      expect(truncateText('Hello World', 5)).toBe('He...')
    })
  })
})
