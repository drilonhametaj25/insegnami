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
      await prisma.lesson.deleteMany({ where: { tenantId: tid, class: { name: { startsWith: 'Classe Test' } } } });
      await prisma.class.deleteMany({ where: { tenantId: tid, name: { startsWith: 'Classe Test' } } });
      await prisma.teacher.deleteMany({ where: { tenantId: tid, firstName: { startsWith: 'TestDoc' } } }).catch(() => {});
      const stud = await prisma.student.findMany({
        where: { tenantId: tid, firstName: { startsWith: 'TestStud' } },
        select: { id: true, userId: true },
      });
      await prisma.student.deleteMany({ where: { id: { in: stud.map((s) => s.id) } } });
      const sUserIds = stud.map((s) => s.userId).filter(Boolean) as string[];
      if (sUserIds.length) await prisma.user.deleteMany({ where: { id: { in: sUserIds } } });

      // 2) Reset billing → nessun abbonamento + trial generoso
      await prisma.tenantAddon.deleteMany({ where: { tenantId: tid } });
      await prisma.subscription.deleteMany({ where: { tenantId: tid } });
      await prisma.tenant.update({
        where: { id: tid },
        data: { plan: 'basic', trialUntil: new Date(Date.now() + 14 * 86400000), isActive: true },
      });

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
