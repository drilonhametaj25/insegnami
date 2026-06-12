import { can } from '@/lib/permissions/matrix'

describe('permission matrix', () => {
  it('lets TEACHER read payroll (own payslips, filtered at route level)', () => {
    expect(can('TEACHER', 'read', 'payroll')).toBe(true)
  })

  it('does not let TEACHER create or approve payroll', () => {
    expect(can('TEACHER', 'create', 'payroll')).toBe(false)
    expect(can('TEACHER', 'update', 'payroll')).toBe(false)
    expect(can('TEACHER', 'delete', 'payroll')).toBe(false)
  })

  it('keeps payroll closed to STUDENT and PARENT', () => {
    expect(can('STUDENT', 'read', 'payroll')).toBe(false)
    expect(can('PARENT', 'read', 'payroll')).toBe(false)
  })

  it('keeps full payroll access for ADMIN', () => {
    expect(can('ADMIN', 'read', 'payroll')).toBe(true)
    expect(can('ADMIN', 'create', 'payroll')).toBe(true)
  })
})
