import { randomUUID } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import type { Session } from 'next-auth'

/**
 * Fixture di tenant completa per i test integration-DB.
 *
 * Crea un tenant ISOLATO (slug random) con tutto il necessario per testare
 * invoices / payroll / accounting contro un Postgres reale:
 *   - admin user + UserTenant ADMIN (da impersonare mockando @/lib/auth#getAuth)
 *   - trialUntil futuro → getTenantAccessCached dà verdetto ok (tenant-guard passa)
 *   - 1 teacher ACTIVE con hourlyRate + TeacherPayrollSettings di default
 *   - 1 student (con relativo user account, FK obbligatoria)
 *   - 1 course + 1 class del teacher
 *   - 2 lezioni COMPLETED nel mese corrente (2h + 1.5h = 3.5h per il payroll)
 *   - InvoiceSettings (cedente) + InvoiceSeries default + customer profile
 *
 * destroy() cancella tutto. NON si affida al solo cascade del tenant perché
 * alcune FK interne sono RESTRICT (Class→Course, Lesson→Teacher, Invoice→Series):
 * durante il cascade Postgres le verifica subito e farebbe fallire la DELETE.
 * Quindi cancelliamo in ordine di dipendenza esplicito.
 */

export const TEACHER_HOURLY_RATE = 20
export const LESSON_HOURS = [2, 1.5] // durate delle 2 lezioni COMPLETED
export const TOTAL_LESSON_HOURS = 3.5

export type TenantFixture = {
  tenantId: string
  slug: string
  adminUser: { id: string; email: string; firstName: string; lastName: string }
  studentUserId: string
  teacherId: string
  studentId: string
  courseId: string
  classId: string
  lessonIds: string[]
  seriesId: string
  customerProfileId: string
  invoiceSettingsId: string
  /** Anno/mese delle lezioni COMPLETED (mese corrente). */
  periodYear: number
  periodMonth: number
  destroy: () => Promise<void>
}

/**
 * Session next-auth finta per impersonare l'admin della fixture.
 * Da usare come valore di ritorno del mock di getAuth:
 *   (getAuth as jest.Mock).mockResolvedValue(buildAdminSession(fixture))
 */
export function buildAdminSession(fixture: TenantFixture): Session {
  return {
    user: {
      id: fixture.adminUser.id,
      email: fixture.adminUser.email,
      firstName: fixture.adminUser.firstName,
      lastName: fixture.adminUser.lastName,
      role: 'ADMIN',
      tenantId: fixture.tenantId,
      tenantName: `Test School ${fixture.slug}`,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as unknown as Session
}

export async function createTenantFixture(prisma: PrismaClient): Promise<TenantFixture> {
  const uid = randomUUID().slice(0, 8)
  const now = new Date()
  const periodYear = now.getUTCFullYear()
  const periodMonth = now.getUTCMonth() + 1 // 1-12

  // Tenant in trial attivo: il tenant-guard (getTenantAccessCached) passa.
  // featureFlags: le route contabilità sono feature-gated (einvoicing/
  // accounting/payroll/hoursPackages) — l'override per-tenant vince sempre
  // sul piano, quindi la fixture abilita esplicitamente ciò che testiamo.
  const tenant = await prisma.tenant.create({
    data: {
      name: `Test School ${uid}`,
      slug: `test-school-${uid}`,
      trialUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      featureFlags: {
        einvoicing: true,
        accounting: true,
        payroll: true,
        hoursPackages: true,
      },
    },
  })

  // Admin user + membership ADMIN. La password non serve: getAuth è mockato.
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-${uid}@integration.test`,
      password: 'not-used-in-tests',
      firstName: 'Admin',
      lastName: 'Fixture',
      status: 'ACTIVE',
      tenants: {
        create: { tenantId: tenant.id, role: 'ADMIN' },
      },
    },
  })

  // Teacher ACTIVE con rate orario e settings payroll di default (nessuna
  // ritenuta → netAmount = grossBase, più semplice da asserire).
  const teacher = await prisma.teacher.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Teach',
      lastName: 'Fixture',
      email: `teacher-${uid}@integration.test`,
      teacherCode: `TEA-${uid}`,
      status: 'ACTIVE',
      hourlyRate: TEACHER_HOURLY_RATE,
      payrollSettings: {
        create: { defaultWithholdings: [] },
      },
    },
  })

  // Student (richiede uno user account dedicato — FK obbligatoria).
  const studentUser = await prisma.user.create({
    data: {
      email: `student-${uid}@integration.test`,
      password: 'not-used-in-tests',
      firstName: 'Stud',
      lastName: 'Fixture',
      status: 'ACTIVE',
    },
  })
  const student = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      userId: studentUser.id,
      firstName: 'Stud',
      lastName: 'Fixture',
      dateOfBirth: new Date('2010-01-15'),
      studentCode: `STU-${uid}`,
      status: 'ACTIVE',
    },
  })

  // Course + Class del teacher.
  const course = await prisma.course.create({
    data: {
      tenantId: tenant.id,
      name: `Corso ${uid}`,
      code: `CRS-${uid}`,
    },
  })
  const klass = await prisma.class.create({
    data: {
      tenantId: tenant.id,
      courseId: course.id,
      teacherId: teacher.id,
      name: `Classe ${uid}`,
      code: `CLS-${uid}`,
      startDate: new Date(Date.UTC(periodYear, periodMonth - 1, 1)),
      students: {
        create: { studentId: student.id },
      },
    },
  })

  // 2 lezioni COMPLETED nel mese corrente: 2h (giorno 5) + 1.5h (giorno 10).
  // Il timesheet calculator conta solo COMPLETED con startTime nel periodo.
  const lesson1 = await prisma.lesson.create({
    data: {
      tenantId: tenant.id,
      classId: klass.id,
      teacherId: teacher.id,
      title: 'Lezione 1',
      startTime: new Date(Date.UTC(periodYear, periodMonth - 1, 5, 9, 0, 0)),
      endTime: new Date(Date.UTC(periodYear, periodMonth - 1, 5, 11, 0, 0)),
      status: 'COMPLETED',
    },
  })
  const lesson2 = await prisma.lesson.create({
    data: {
      tenantId: tenant.id,
      classId: klass.id,
      teacherId: teacher.id,
      title: 'Lezione 2',
      startTime: new Date(Date.UTC(periodYear, periodMonth - 1, 10, 14, 0, 0)),
      endTime: new Date(Date.UTC(periodYear, periodMonth - 1, 10, 15, 30, 0)),
      status: 'COMPLETED',
    },
  })

  // Fatturazione: dati cedente (scuola) + sezionale default + anagrafica cliente.
  const invoiceSettings = await prisma.invoiceSettings.create({
    data: {
      tenantId: tenant.id,
      denominazione: `Test School ${uid} SRL`,
      partitaIva: 'IT01234567890',
      codiceFiscale: '01234567890',
      indirizzo: 'Via dei Test 1',
      cap: '20100',
      comune: 'Milano',
      provincia: 'MI',
    },
  })
  const series = await prisma.invoiceSeries.create({
    data: {
      tenantId: tenant.id,
      code: 'VEN',
      prefix: 'F',
      description: 'Sezionale vendite (fixture)',
      isDefault: true,
      isActive: true,
    },
  })
  const customerProfile = await prisma.invoiceCustomerProfile.create({
    data: {
      tenantId: tenant.id,
      studentId: student.id,
      nome: 'Mario',
      cognome: 'Rossi',
      codiceFiscale: 'RSSMRA80A01F205X',
      indirizzo: 'Via Cliente 2',
      cap: '20100',
      comune: 'Milano',
      provincia: 'MI',
    },
  })

  const destroy = async () => {
    const tenantId = tenant.id
    // Ordine di cancellazione esplicito: prima le foglie, poi le entità
    // referenziate da FK RESTRICT, infine il tenant (cascade per il resto).
    await prisma.accountingMovement.deleteMany({ where: { tenantId } })
    await prisma.payroll.deleteMany({ where: { tenantId } }) // cascade su lineItems/withholdings
    await prisma.payrollPeriod.deleteMany({ where: { tenantId } })
    await prisma.invoice.deleteMany({ where: { tenantId } }) // cascade su lines/sdiEvents
    await prisma.invoiceSeries.deleteMany({ where: { tenantId } })
    await prisma.invoiceCustomerProfile.deleteMany({ where: { tenantId } })
    await prisma.invoiceSettings.deleteMany({ where: { tenantId } })
    await prisma.payment.deleteMany({ where: { tenantId } })
    await prisma.lesson.deleteMany({ where: { tenantId } }) // prima delle classi/teacher (RESTRICT)
    await prisma.class.deleteMany({ where: { tenantId } }) // cascade su studentClass
    await prisma.course.deleteMany({ where: { tenantId } })
    await prisma.student.deleteMany({ where: { tenantId } })
    await prisma.teacher.deleteMany({ where: { tenantId } }) // cascade su payrollSettings
    await prisma.tenant.delete({ where: { id: tenantId } }) // cascade su userTenant/auditLog/...
    // Gli User sono globali (nessuna FK verso tenant): cancellazione esplicita.
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, studentUser.id] } } })
  }

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
    },
    studentUserId: studentUser.id,
    teacherId: teacher.id,
    studentId: student.id,
    courseId: course.id,
    classId: klass.id,
    lessonIds: [lesson1.id, lesson2.id],
    seriesId: series.id,
    customerProfileId: customerProfile.id,
    invoiceSettingsId: invoiceSettings.id,
    periodYear,
    periodMonth,
    destroy,
  }
}
