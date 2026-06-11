#!/usr/bin/env node
/**
 * Crea (o aggiorna) l'utente SUPERADMIN in modo idempotente.
 *
 * Uso:
 *   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node scripts/create-superadmin.mjs
 *   node scripts/create-superadmin.mjs <email> <password>
 *
 * Rieseguirlo con la stessa email REIMPOSTA la password: è il percorso di
 * recovery ufficiale. La password non viene mai loggata.
 *
 * Pensato per girare anche dentro il container di produzione (standalone
 * Next.js): usa solo @prisma/client e bcryptjs, già presenti nell'immagine.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const email = process.env.SUPERADMIN_EMAIL || process.argv[2];
const password = process.env.SUPERADMIN_PASSWORD || process.argv[3];

if (!email || !password) {
  console.error(
    'Uso: SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node scripts/create-superadmin.mjs\n' +
      '  oppure: node scripts/create-superadmin.mjs <email> <password>'
  );
  process.exit(1);
}

// Stessi requisiti del flusso di registrazione (min 8, minuscola+maiuscola+cifra).
if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error(
    'Password troppo debole: minimo 8 caratteri con almeno una minuscola, una maiuscola e una cifra.'
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash(password, 12);

  // Tenant di ancoraggio: il ruolo arriva da UserTenant, quindi il superadmin
  // deve essere collegato a un tenant qualsiasi. Preferiamo 'system'.
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'system' }, select: { id: true } });
  if (!tenant) {
    tenant = await prisma.tenant.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  }
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'System', slug: 'system', isActive: true },
      select: { id: true },
    });
    console.log('Creato tenant di ancoraggio "system"');
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hashed,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
    update: {
      password: hashed,
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
    select: { id: true },
  });

  const existingLink = await prisma.userTenant.findFirst({
    where: { userId: user.id },
    select: { id: true, role: true },
  });

  if (existingLink) {
    if (existingLink.role !== 'SUPERADMIN') {
      await prisma.userTenant.update({
        where: { id: existingLink.id },
        data: { role: 'SUPERADMIN' },
      });
    }
  } else {
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'SUPERADMIN', permissions: {} },
    });
  }

  console.log(`Superadmin pronto: ${email} (password aggiornata)`);
}

main()
  .catch((err) => {
    console.error('Errore creazione superadmin:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
