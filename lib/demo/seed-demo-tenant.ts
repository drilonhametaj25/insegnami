import { Role, UserStatus, GradeType, NoticeType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

/**
 * Tenant demo pubblico (slug 'demo').
 *
 * - seedDemoTenant(): crea/aggiorna il tenant demo con dati verosimili
 *   compatti. IDEMPOTENTE: upsert sulle chiavi uniche; i dati "volatili"
 *   (lezioni, appelli, voti, pagamenti, avvisi) vengono rigenerati a ogni
 *   run per avere sempre la settimana corrente popolata.
 * - resetDemoTenant(): cancella TUTTI i dati del tenant demo (delete per
 *   tenantId in ordine FK-safe) e ri-esegue il seed. Usata dal cron
 *   'reset-demo-tenant' delle 03:00 e riusabile dagli script.
 *
 * Login demo: demo@insegnami.pro / env DEMO_PASSWORD
 * (default 'demo1234' SOLO fuori produzione).
 */

export const DEMO_TENANT_SLUG = 'demo';
export const DEMO_EMAIL = 'demo@insegnami.pro';

function demoPassword(): string {
  const fromEnv = process.env.DEMO_PASSWORD;
  if (fromEnv && fromEnv.length >= 6) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DEMO_PASSWORD mancante: in produzione la password del tenant demo DEVE arrivare da env.'
    );
  }
  // Default esplicitamente solo per sviluppo/test
  return 'demo1234';
}

/** Lunedì (00:00 locale del processo) della settimana corrente. */
function startOfCurrentWeek(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domenica
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

const ADMIN_PERMS = JSON.stringify({
  users: { create: true, read: true, update: true, delete: true },
  students: { create: true, read: true, update: true, delete: true },
  teachers: { create: true, read: true, update: true, delete: true },
  classes: { create: true, read: true, update: true, delete: true },
  lessons: { create: true, read: true, update: true, delete: true },
  attendance: { create: true, read: true, update: true, delete: true },
  payments: { create: true, read: true, update: true, delete: true },
  notices: { create: true, read: true, update: true, delete: true },
  reports: { create: true, read: true, update: true, delete: true },
});

export async function seedDemoTenant(): Promise<{ tenantId: string }> {
  const trialUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // --- Tenant ---
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: { trialUntil, isActive: true },
    create: {
      name: 'Scuola Demo "Lingua Viva"',
      slug: DEMO_TENANT_SLUG,
      plan: 'demo',
      isActive: true,
      trialUntil,
      setupStage: 'COMPLETE',
      setupCompletedAt: new Date(),
      featureFlags: JSON.stringify({
        attendance: true,
        payments: true,
        communications: true,
        calendar: true,
        reports: true,
        parentPortal: true,
      }),
    },
  });

  // --- Utente demo (ADMIN del tenant demo) ---
  const hashedPassword = await bcrypt.hash(demoPassword(), 12);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    // Password sempre riallineata all'env a ogni seed
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email: DEMO_EMAIL,
      password: hashedPassword,
      firstName: 'Utente',
      lastName: 'Demo',
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // authorize() sceglie la membership PIÙ VECCHIA: il login demo deve
  // atterrare sul tenant demo, quindi rimuoviamo eventuali link ad altri
  // tenant (es. vecchi seed che collegavano demo@ al tenant di sviluppo).
  await prisma.userTenant.deleteMany({
    where: { userId: demoUser.id, tenantId: { not: tenant.id } },
  });
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: tenant.id } },
    update: { role: Role.ADMIN },
    create: {
      userId: demoUser.id,
      tenantId: tenant.id,
      role: Role.ADMIN,
      permissions: ADMIN_PERMS,
    },
  });

  // --- Docente demo ---
  const teacher = await prisma.teacher.upsert({
    where: { tenantId_teacherCode: { tenantId: tenant.id, teacherCode: 'DEMO-T01' } },
    update: {},
    create: {
      firstName: 'Laura',
      lastName: 'Santini',
      email: 'laura.santini@demo.insegnami.pro',
      phone: '+39 333 0000001',
      teacherCode: 'DEMO-T01',
      qualifications: 'Laurea in Lingue, certificazione CELTA',
      specializations: 'Inglese generale, preparazione certificazioni',
      contractType: 'Part-time',
      hourlyRate: 28.0,
      tenantId: tenant.id,
      status: UserStatus.ACTIVE,
    },
  });

  // --- Corso ---
  const course = await prisma.course.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ING-BASE' } },
    update: {},
    create: {
      name: 'Corso di Inglese - Base',
      code: 'ING-BASE',
      description: 'Corso di inglese per principianti: grammatica, lessico e conversazione.',
      category: 'Lingue',
      level: 'Base',
      duration: 60,
      maxStudents: 12,
      minStudents: 4,
      price: 420.0,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  // --- 2 classi ---
  const year = new Date().getFullYear();
  const classA = await prisma.class.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ING-A1-MATT' } },
    update: { teacherId: teacher.id, courseId: course.id },
    create: {
      name: 'Inglese A1 - Mattina',
      code: 'ING-A1-MATT',
      courseId: course.id,
      teacherId: teacher.id,
      startDate: new Date(`${year}-01-08`),
      endDate: new Date(`${year}-12-20`),
      maxStudents: 12,
      tenantId: tenant.id,
      isActive: true,
    },
  });
  const classB = await prisma.class.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ING-A2-SERA' } },
    update: { teacherId: teacher.id, courseId: course.id },
    create: {
      name: 'Inglese A2 - Sera',
      code: 'ING-A2-SERA',
      courseId: course.id,
      teacherId: teacher.id,
      startDate: new Date(`${year}-01-08`),
      endDate: new Date(`${year}-12-20`),
      maxStudents: 12,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  // --- Materia + anno scolastico (servono per i voti) ---
  const subject = await prisma.subject.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ING' } },
    update: {},
    create: {
      name: 'Inglese',
      code: 'ING',
      color: '#3b82f6',
      weeklyHours: 3,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  const yearName = `${year}/${year + 1}`;
  const academicYear = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: yearName } },
    update: { isCurrent: true },
    create: {
      name: yearName,
      startDate: new Date(`${year}-09-01`),
      endDate: new Date(`${year + 1}-06-30`),
      isCurrent: true,
      tenantId: tenant.id,
    },
  });

  let period = await prisma.academicPeriod.findFirst({
    where: { academicYearId: academicYear.id },
    orderBy: { orderIndex: 'asc' },
  });
  if (!period) {
    period = await prisma.academicPeriod.create({
      data: {
        name: '1° Quadrimestre',
        type: 'QUADRIMESTRE',
        startDate: new Date(`${year}-09-01`),
        endDate: new Date(`${year + 1}-01-31`),
        orderIndex: 1,
        academicYearId: academicYear.id,
      },
    });
  }

  // --- 8 studenti con nomi plausibili ---
  const studentDefs = [
    { first: 'Giulia', last: 'Marchetti' },
    { first: 'Lorenzo', last: 'De Luca' },
    { first: 'Martina', last: 'Colombo' },
    { first: 'Alessandro', last: 'Rinaldi' },
    { first: 'Francesca', last: 'Barbieri' },
    { first: 'Matteo', last: 'Fontana' },
    { first: 'Elisa', last: 'Caruso' },
    { first: 'Davide', last: 'Serra' },
  ];

  const students = [] as { id: string }[];
  for (let i = 0; i < studentDefs.length; i++) {
    const def = studentDefs[i];
    const email = `${def.first.toLowerCase()}.${def.last.toLowerCase().replace(/\s+/g, '')}@demo.insegnami.pro`;

    // Student.userId è obbligatorio: ogni studente demo ha il suo User
    const studentUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        firstName: def.first,
        lastName: def.last,
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
      },
    });
    await prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: studentUser.id, tenantId: tenant.id } },
      update: {},
      create: {
        userId: studentUser.id,
        tenantId: tenant.id,
        role: Role.STUDENT,
        permissions: JSON.stringify({
          classes: { read: true },
          lessons: { read: true },
          attendance: { read: true },
          payments: { read: true },
          notices: { read: true },
        }),
      },
    });

    const student = await prisma.student.upsert({
      where: {
        tenantId_studentCode: { tenantId: tenant.id, studentCode: `DEMO-S${String(i + 1).padStart(2, '0')}` },
      },
      update: { userId: studentUser.id },
      create: {
        firstName: def.first,
        lastName: def.last,
        email,
        phone: `+39 333 00001${String(i).padStart(2, '0')}`,
        dateOfBirth: new Date(1994 + i, (i * 2) % 12, 5 + i),
        studentCode: `DEMO-S${String(i + 1).padStart(2, '0')}`,
        address: `Via dei Girasoli ${10 + i}, Bologna`,
        tenantId: tenant.id,
        status: UserStatus.ACTIVE,
        userId: studentUser.id,
      },
    });
    students.push(student);

    // 4 studenti in classe A, 4 in classe B
    const classId = i < 4 ? classA.id : classB.id;
    await prisma.studentClass.upsert({
      where: { studentId_classId: { studentId: student.id, classId } },
      update: { isActive: true },
      create: { studentId: student.id, classId, isActive: true },
    });
  }

  // --- Dati volatili: rigenerati a ogni run (settimana corrente) ---
  // Ordine FK: prima i figli (attendance cascano dalle lezioni).
  await prisma.grade.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.lesson.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.notice.deleteMany({ where: { tenantId: tenant.id } });

  // Lezioni della settimana corrente con appelli:
  // classe A → lun/mer/ven 09:00, classe B → mar/gio 18:30.
  const monday = startOfCurrentWeek();
  const now = new Date();
  const schedule: Array<{ classId: string; students: { id: string }[]; dayOffset: number; hour: number; minute: number; room: string; label: string }> = [
    { classId: classA.id, students: students.slice(0, 4), dayOffset: 0, hour: 9, minute: 0, room: 'Aula 1', label: 'Inglese A1' },
    { classId: classA.id, students: students.slice(0, 4), dayOffset: 2, hour: 9, minute: 0, room: 'Aula 1', label: 'Inglese A1' },
    { classId: classA.id, students: students.slice(0, 4), dayOffset: 4, hour: 9, minute: 0, room: 'Aula 1', label: 'Inglese A1' },
    { classId: classB.id, students: students.slice(4), dayOffset: 1, hour: 18, minute: 30, room: 'Aula 2', label: 'Inglese A2' },
    { classId: classB.id, students: students.slice(4), dayOffset: 3, hour: 18, minute: 30, room: 'Aula 2', label: 'Inglese A2' },
  ];

  const attendancePattern = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'ABSENT', 'PRESENT', 'PRESENT'] as const;

  for (const slot of schedule) {
    const start = new Date(monday);
    start.setDate(monday.getDate() + slot.dayOffset);
    start.setHours(slot.hour, slot.minute, 0, 0);
    const end = new Date(start.getTime() + 90 * 60000);
    const isPast = end.getTime() < now.getTime();

    const lesson = await prisma.lesson.create({
      data: {
        title: `${slot.label} - Lezione settimanale`,
        startTime: start,
        endTime: end,
        room: slot.room,
        classId: slot.classId,
        teacherId: teacher.id,
        tenantId: tenant.id,
        status: isPast ? 'COMPLETED' : 'SCHEDULED',
      },
    });

    // Appello solo per le lezioni già svolte
    if (isPast) {
      for (let i = 0; i < slot.students.length; i++) {
        await prisma.attendance.create({
          data: {
            studentId: slot.students[i].id,
            lessonId: lesson.id,
            status: attendancePattern[(i + slot.dayOffset) % attendancePattern.length],
          },
        });
      }
    }
  }

  // Qualche voto (classe A, materia Inglese)
  const gradeDefs = [
    { studentIdx: 0, value: 8.5, type: GradeType.WRITTEN, description: 'Verifica di grammatica' },
    { studentIdx: 1, value: 7.0, type: GradeType.ORAL, description: 'Interrogazione orale' },
    { studentIdx: 2, value: 9.0, type: GradeType.WRITTEN, description: 'Compito in classe' },
    { studentIdx: 3, value: 6.5, type: GradeType.PRACTICAL, description: 'Esercitazione di ascolto' },
    { studentIdx: 4, value: 7.5, type: GradeType.ORAL, description: 'Presentazione orale' },
    { studentIdx: 5, value: 8.0, type: GradeType.WRITTEN, description: 'Verifica sul lessico' },
  ];
  for (const g of gradeDefs) {
    await prisma.grade.create({
      data: {
        tenantId: tenant.id,
        studentId: students[g.studentIdx].id,
        subjectId: subject.id,
        teacherId: teacher.id,
        classId: g.studentIdx < 4 ? classA.id : classB.id,
        periodId: period.id,
        value: g.value,
        type: g.type,
        description: g.description,
        date: new Date(now.getTime() - (g.studentIdx + 1) * 3 * 24 * 60 * 60 * 1000),
        weight: 1.0,
        isVisible: true,
      },
    });
  }

  // Qualche pagamento (mix pagato / in attesa)
  for (let i = 0; i < students.length; i++) {
    const paid = i % 3 !== 0;
    await prisma.payment.create({
      data: {
        studentId: students[i].id,
        amount: 420.0,
        description: 'Quota corso Inglese - Base',
        dueDate: new Date(now.getTime() + (paid ? -20 : 10) * 24 * 60 * 60 * 1000),
        status: paid ? 'PAID' : 'PENDING',
        paidDate: paid ? new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000) : undefined,
        paymentMethod: paid ? 'BANK_TRANSFER' : undefined,
        tenantId: tenant.id,
      },
    });
  }

  // Un avviso di benvenuto
  await prisma.notice.create({
    data: {
      title: 'Benvenuto nella demo di InsegnaMi.pro',
      content:
        'Questo è un ambiente dimostrativo con dati fittizi: esplora liberamente studenti, classi, lezioni, presenze e pagamenti. I dati vengono ripristinati ogni notte.',
      type: NoticeType.ANNOUNCEMENT,
      isPublic: true,
      targetRoles: [Role.ADMIN, Role.TEACHER, Role.STUDENT],
      isPinned: true,
      tenantId: tenant.id,
    },
  });

  return { tenantId: tenant.id };
}

/**
 * Cancella tutti i dati del tenant demo (delete per tenantId, ordine FK-safe:
 * prima le tabelle che referenziano Teacher/Course/AcademicYear con onDelete
 * Restrict) e ri-esegue il seed. Le tabelle figlie senza tenantId (Attendance,
 * StudentClass, AcademicPeriod, InvoiceLine, ...) cascano dai rispettivi padri.
 */
export async function resetDemoTenant(): Promise<{ tenantId: string } | { skipped: true }> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    // Tenant demo mai seedato: il seed lo crea da zero
    const seeded = await seedDemoTenant();
    return seeded;
  }
  const tenantId = tenant.id;

  // 1. Log/registri senza dipendenze
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.emailLog.deleteMany({ where: { tenantId } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.analyticsSnapshot.deleteMany({ where: { tenantId } });
  await prisma.dashboardWidget.deleteMany({ where: { tenantId } });
  await prisma.report.deleteMany({ where: { tenantId } });

  // 2. Registro ore (referenzia HoursPackage + Lesson)
  await prisma.hoursLedger.deleteMany({ where: { tenantId } });

  // 3. Didattica che referenzia Teacher (Restrict) o Student
  await prisma.grade.deleteMany({ where: { tenantId } });
  await prisma.reportCard.deleteMany({ where: { tenantId } });
  await prisma.disciplinaryNote.deleteMany({ where: { tenantId } });
  await prisma.homework.deleteMany({ where: { tenantId } });
  await prisma.parentMeeting.deleteMany({ where: { tenantId } });
  await prisma.absenceJustification.deleteMany({ where: { tenantId } });

  // 4. Contabilità/fatturazione (Invoice referenzia Series/CustomerProfile con Restrict)
  await prisma.payroll.deleteMany({ where: { tenantId } });
  await prisma.payrollPeriod.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.invoiceSeries.deleteMany({ where: { tenantId } });
  await prisma.invoiceCustomerProfile.deleteMany({ where: { tenantId } });
  await prisma.invoiceSettings.deleteMany({ where: { tenantId } });
  await prisma.accountingMovement.deleteMany({ where: { tenantId } });

  // 5. Comunicazioni
  await prisma.message.deleteMany({ where: { tenantId } });
  await prisma.messageTemplate.deleteMany({ where: { tenantId } });
  await prisma.communicationGroup.deleteMany({ where: { tenantId } });
  await prisma.notice.deleteMany({ where: { tenantId } });
  await prisma.event.deleteMany({ where: { tenantId } });

  // 6. Orari (Schedule referenzia AcademicYear con Restrict) e materiali
  await prisma.material.deleteMany({ where: { tenantId } });
  await prisma.schedule.deleteMany({ where: { tenantId } });
  await prisma.timeSlotConfig.deleteMany({ where: { tenantId } });
  await prisma.holiday.deleteMany({ where: { tenantId } });

  // 7. Lezioni (referenziano Teacher con Restrict; Attendance casca)
  await prisma.lesson.deleteMany({ where: { tenantId } });
  await prisma.hoursPackage.deleteMany({ where: { tenantId } });

  // 8. Anagrafiche (StudentClass/TeacherSubject/ClassSubject cascano)
  await prisma.studentGuardian.deleteMany({ where: { tenantId } });
  await prisma.student.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.course.deleteMany({ where: { tenantId } });
  await prisma.subject.deleteMany({ where: { tenantId } });
  await prisma.academicYear.deleteMany({ where: { tenantId } });
  await prisma.teacher.deleteMany({ where: { tenantId } });

  // 9. Billing piattaforma + membership utenti (il seed le ricrea)
  await prisma.tenantAddon.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.userTenant.deleteMany({ where: { tenantId } });

  return seedDemoTenant();
}
