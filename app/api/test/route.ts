import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Endpoint helper PER I SOLI TEST E2E (Playwright).
 *
 * Disponibile esclusivamente fuori da produzione. Permette ai test di:
 *  - recuperare il token di verifica email di un utente appena registrato
 *  - completare/azzerare l'onboarding di un tenant
 *  - azzerare lo stato commerciale (subscription + add-on)
 *  - eliminare un tenant/utente di test per ri-eseguire la registrazione
 *
 * NON viene mai servito in produzione (ritorna 404).
 */
function guard(): NextResponse | null {
  // `next start` forza NODE_ENV=production anche in CI: il flag dedicato
  // E2E_TEST_ENDPOINTS=1 abilita gli helper e2e sulla build di produzione
  // dei workflow di test. In produzione VERA il flag non va mai impostato.
  if (process.env.E2E_TEST_ENDPOINTS === '1') return null;
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = guard();
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const { action } = body as { action?: string };

  switch (action) {
    case 'verification-token': {
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: { verificationToken: true, email: true },
      });
      if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });
      return NextResponse.json({ token: user.verificationToken, email: user.email });
    }

    case 'complete-onboarding': {
      const tenant = await prisma.tenant.findFirst({
        where: body.slug ? { slug: body.slug } : undefined,
        orderBy: { createdAt: 'asc' },
      });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { setupStage: 'COMPLETE', setupCompletedAt: new Date(), isActive: true },
      });
      return NextResponse.json({ ok: true, tenantId: tenant.id });
    }

    case 'reset-test-data': {
      // Prepara un tenant "pulito" e con ampi limiti per i test dei moduli:
      // azzera abbonamento/add-on, imposta un trial generoso, e rimuove i
      // dati di test accumulati in ordine FK-safe.
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      const tid = tenant.id;

      // 1) Pulizia dati di test (ordine FK-safe: lezioni → classi → docenti → studenti)
      await prisma.lesson.deleteMany({ where: { tenantId: tid, title: { startsWith: 'Lezione Test' } } });
      await prisma.lesson.deleteMany({ where: { tenantId: tid, title: { startsWith: 'Serie Test' } } });
      await prisma.lesson.deleteMany({ where: { tenantId: tid, class: { name: { startsWith: 'Classe Test' } } } });
      await prisma.class.deleteMany({ where: { tenantId: tid, name: { startsWith: 'Classe Test' } } });
      // Esclude i 'TestDocLimite' di commercial-flow.spec (serial, parallelo a
      // questi moduli): quei docenti servono a far scattare i limiti di piano
      // e vengono ripuliti dalla suite stessa via delete-teachers-by-prefix.
      await prisma.teacher
        .deleteMany({
          where: {
            tenantId: tid,
            firstName: { startsWith: 'TestDoc' },
            NOT: { firstName: { startsWith: 'TestDocLimite' } },
          },
        })
        .catch(() => {});
      const stud = await prisma.student.findMany({
        where: { tenantId: tid, firstName: { startsWith: 'TestStud' } },
        select: { id: true, userId: true },
      });
      await prisma.student.deleteMany({ where: { id: { in: stud.map((s) => s.id) } } });
      const sUserIds = stud.map((s) => s.userId).filter(Boolean) as string[];
      if (sUserIds.length) await prisma.user.deleteMany({ where: { id: { in: sUserIds } } });

      // 2) Trial generoso + tenant attivo. NON tocca abbonamento/add-on:
      // commercial-flow.spec (serial) dipende dal proprio stato billing e
      // gira in parallelo ai moduli che chiamano reset-test-data; per il
      // reset completo del billing c'è l'azione dedicata 'reset-billing'.
      await prisma.tenant.update({
        where: { id: tid },
        data: { plan: 'basic', trialUntil: new Date(Date.now() + 14 * 86400000), isActive: true },
      });

      return NextResponse.json({ ok: true });
    }

    case 'reset-payroll': {
      // Riporta il payroll del tenant allo stato vergine: il flusso e2e
      // (genera → approva → paga) non è altrimenti ri-eseguibile perché i
      // cedolini PAID non sono né rigenerabili né eliminabili dalla UI.
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      await prisma.payroll.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.payrollPeriod.deleteMany({ where: { tenantId: tenant.id } });
      return NextResponse.json({ ok: true });
    }

    case 'delete-teachers-by-prefix': {
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      const res = await prisma.teacher.deleteMany({
        where: { tenantId: tenant.id, firstName: { startsWith: body.prefix || 'TestDoc' } },
      });
      return NextResponse.json({ ok: true, deleted: res.count });
    }

    case 'delete-students-by-prefix': {
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      // Rimuove anche gli user "ombra" collegati
      const students = await prisma.student.findMany({
        where: { tenantId: tenant.id, firstName: { startsWith: body.prefix || 'TestStud' } },
        select: { id: true, userId: true },
      });
      const userIds = students.map((s) => s.userId).filter(Boolean) as string[];
      await prisma.student.deleteMany({ where: { id: { in: students.map((s) => s.id) } } });
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      return NextResponse.json({ ok: true, deleted: students.length });
    }

    case 'delete-lessons-by-prefix': {
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      const res = await prisma.lesson.deleteMany({
        where: { tenantId: tenant.id, title: { startsWith: body.prefix || 'Lezione Test' } },
      });
      return NextResponse.json({ ok: true, deleted: res.count });
    }

    case 'get-tenant': {
      const tenant = await prisma.tenant.findFirst({
        where: { slug: body.slug },
        select: {
          id: true, name: true, slug: true, address: true, phone: true,
          email: true, setupStage: true, setupCompletedAt: true, plan: true,
        },
      });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      return NextResponse.json({ tenant });
    }

    case 'reset-onboarding': {
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { setupStage: 'INITIAL', setupCompletedAt: null },
      });
      return NextResponse.json({ ok: true });
    }

    case 'reset-billing': {
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      await prisma.tenantAddon.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { plan: 'basic' },
      });
      return NextResponse.json({ ok: true });
    }

    case 'set-trial': {
      const tenant = await prisma.tenant.findFirst({ where: { slug: body.slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      const days = typeof body.days === 'number' ? body.days : 14;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { trialUntil: new Date(Date.now() + days * 86400000) },
      });
      return NextResponse.json({ ok: true });
    }

    case 'clear-rate-limits': {
      // Azzera i contatori di rate limiting (rl:*) così i test ripetuti
      // (registrazione, contact) non si bloccano a vicenda tra run.
      const { redis } = await import('@/lib/redis');
      const client = redis.getClient();
      if (client) {
        const keys = await client.keys('rl:*');
        if (keys.length) await client.del(...keys);
        return NextResponse.json({ ok: true, cleared: keys.length });
      }
      return NextResponse.json({ ok: true, cleared: 0 });
    }

    case 'get-cross-tenant-ids': {
      // Ritorna un ID di risorsa per modulo del tenant indicato (default: il
      // tenant principale del seed). Usato dai test e2e di isolamento tenant
      // per tentare accessi cross-tenant da un account di un altro tenant.
      const slug = typeof body.slug === 'string' ? body.slug : 'english-plus';
      const tenant = await prisma.tenant.findFirst({ where: { slug } });
      if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
      const tid = tenant.id;

      const [
        student, teacher, klass, lesson, payment, notice, grade, homework,
        disciplinaryNote, parentMeeting, reportCard, hoursPackage, course,
        subject, academicYear, attendance, message, invoice, payrollPeriod,
        payroll, accountingMovement, userTenant,
      ] = await Promise.all([
        prisma.student.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.teacher.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.class.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.lesson.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.payment.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.notice.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.grade.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.homework.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.disciplinaryNote.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.parentMeeting.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.reportCard.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.hoursPackage.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.course.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.subject.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.academicYear.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        // Attendance non ha tenantId diretto: lo scope passa dalla lezione
        prisma.attendance.findFirst({ where: { lesson: { tenantId: tid } }, select: { id: true } }),
        prisma.message.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.invoice.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.payrollPeriod.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.payroll.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.accountingMovement.findFirst({ where: { tenantId: tid }, select: { id: true } }),
        prisma.userTenant.findFirst({ where: { tenantId: tid }, select: { userId: true } }),
      ]);

      return NextResponse.json({
        tenantId: tid,
        ids: {
          students: student?.id ?? null,
          teachers: teacher?.id ?? null,
          classes: klass?.id ?? null,
          lessons: lesson?.id ?? null,
          payments: payment?.id ?? null,
          notices: notice?.id ?? null,
          grades: grade?.id ?? null,
          homework: homework?.id ?? null,
          disciplinaryNotes: disciplinaryNote?.id ?? null,
          parentMeetings: parentMeeting?.id ?? null,
          reportCards: reportCard?.id ?? null,
          hoursPackages: hoursPackage?.id ?? null,
          courses: course?.id ?? null,
          subjects: subject?.id ?? null,
          academicYears: academicYear?.id ?? null,
          attendance: attendance?.id ?? null,
          messages: message?.id ?? null,
          invoices: invoice?.id ?? null,
          payrollPeriods: payrollPeriod?.id ?? null,
          payrolls: payroll?.id ?? null,
          accountingMovements: accountingMovement?.id ?? null,
          users: userTenant?.userId ?? null,
        },
      });
    }

    case 'delete-user-by-email': {
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { tenants: true },
      });
      if (!user) return NextResponse.json({ ok: true, deleted: false });
      // Elimina i tenant collegati (cascade rimuove user_tenants, subscription, addon)
      const tenantIds = user.tenants.map((ut) => ut.tenantId);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      for (const tid of tenantIds) {
        await prisma.tenant.delete({ where: { id: tid } }).catch(() => {});
      }
      return NextResponse.json({ ok: true, deleted: true });
    }

    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
}
