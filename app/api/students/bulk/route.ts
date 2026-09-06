import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { getEffectiveLimits } from '@/lib/billing/limits';
import { requireAuth, authError } from '@/lib/api-auth';
import { generateStudentCode } from '@/lib/user-profile-sync';
import { checkStudentLimit } from '@/lib/plan-limits';

const bulkActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'suspend', 'delete']),
  studentIds: z.array(z.string()).min(1, 'Seleziona almeno uno studente'),
});

// Import CSV (feature 'bulkImport'): righe già parsate lato client
const importRowSchema = z.object({
  firstName: z.string().trim().min(1, 'Nome richiesto'),
  lastName: z.string().trim().min(1, 'Cognome richiesto'),
  email: z
    .string()
    .trim()
    .email('Email non valida')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

const importSchema = z.object({
  action: z.literal('import'),
  rows: z
    .array(z.record(z.any()))
    .min(1, 'Nessuna riga da importare')
    .max(500, 'Massimo 500 righe per import'),
});

/**
 * Import massivo studenti: per ogni riga crea User "ombra" (o con email
 * reale) + UserTenant STUDENT + Student con codice per-tenant
 * (generateStudentCode). Errori riportati riga per riga; le righe valide
 * vengono comunque create. Check limiti piano via checkStudentLimit.
 */
async function handleImport(body: any) {
  const ctx = await requireAuth({
    roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'],
    feature: 'bulkImport',
  });

  const { rows } = importSchema.parse(body);

  // Limiti piano: le righe oltre i posti disponibili vengono rifiutate
  const limitCheck = ctx.isSuperAdmin ? null : await checkStudentLimit(ctx.tenantId);
  const allowedCount =
    limitCheck && limitCheck.remaining !== null ? limitCheck.remaining : Infinity;

  let created = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = importRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      // Messaggio con il campo in errore (es. "lastName: Required")
      errors.push({
        row: i + 1,
        error: parsed.error.errors
          .map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
          .join('; '),
      });
      continue;
    }
    const row = parsed.data;

    // Data di nascita: se presente deve essere valida
    let dateOfBirth = new Date('1900-01-01');
    if (row.dateOfBirth) {
      const dob = new Date(row.dateOfBirth);
      if (isNaN(dob.getTime())) {
        errors.push({ row: i + 1, error: 'Data di nascita non valida' });
        continue;
      }
      dateOfBirth = dob;
    }

    if (created >= allowedCount) {
      errors.push({
        row: i + 1,
        error:
          "Limite studenti del piano raggiunto: effettua l'upgrade per importare altre righe",
      });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Email reale (se libera) oppure sintetica per il profilo senza login
        let userEmail = row.email ?? '';
        if (userEmail) {
          const existingUser = await tx.user.findUnique({
            where: { email: userEmail },
            select: { id: true },
          });
          if (existingUser) {
            throw new Error(`Email già utilizzata: ${userEmail}`);
          }
        } else {
          const rand = Math.random().toString(36).slice(2, 8);
          userEmail = `studente.${Date.now().toString(36)}${rand}@${ctx.tenantId}.local`;
        }

        const hashedPassword = await bcrypt.hash(
          `${Math.random().toString(36).slice(2)}A1!`,
          10
        );

        const user = await tx.user.create({
          data: {
            email: userEmail,
            password: hashedPassword,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone || null,
            status: 'ACTIVE',
            emailVerified: null,
          } as any,
        });

        await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId: ctx.tenantId,
            role: 'STUDENT',
            permissions: JSON.stringify({
              classes: { read: true },
              lessons: { read: true },
              attendance: { read: true },
              payments: { read: true },
              notices: { read: true },
            }),
          },
        });

        const studentCode = await generateStudentCode(tx, ctx.tenantId);

        await tx.student.create({
          data: {
            tenantId: ctx.tenantId,
            userId: user.id,
            firstName: row.firstName,
            lastName: row.lastName,
            dateOfBirth,
            email: row.email ?? null,
            phone: row.phone || null,
            address: row.address || null,
            studentCode,
            status: 'ACTIVE',
          } as any,
        });
      });
      created += 1;
    } catch (rowError: any) {
      errors.push({
        row: i + 1,
        error: rowError?.message || 'Errore nella creazione dello studente',
      });
    }
  }

  return NextResponse.json({
    data: { created, errors },
    meta: { total: rows.length },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Ramo import CSV (feature 'bulkImport', envelope {data, meta}):
    // requireAuth interno gestisce ruoli, stato tenant e feature gate.
    if (body?.action === 'import') {
      return await handleImport(body);
    }

    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can perform bulk actions
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const validatedData = bulkActionSchema.parse(body);
    const { action, studentIds } = validatedData;

    // Verify all students belong to the same tenant
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: session.user.tenantId,
      },
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        { error: 'Alcuni studenti non sono stati trovati o non appartengono alla tua organizzazione' },
        { status: 404 }
      );
    }

    // Anti-bypass limiti piano: l'attivazione bulk non deve superare
    // maxStudents (l'enforcement sulla POST singola sarebbe altrimenti
    // aggirabile importando INACTIVE e attivando in blocco).
    if (action === 'activate' && session.user.role !== 'SUPERADMIN') {
      const limits = await getEffectiveLimits(session.user.tenantId);
      if (limits.maxStudents != null) {
        const toActivate = students.filter((s) => s.status !== 'ACTIVE').length;
        const currentActive = await prisma.student.count({
          where: { tenantId: session.user.tenantId, status: 'ACTIVE' },
        });
        if (currentActive + toActivate > limits.maxStudents) {
          return NextResponse.json(
            {
              error: `Limite studenti del piano raggiunto (${limits.maxStudents}): impossibile attivare ${toActivate} studenti (attivi: ${currentActive}). Effettua l'upgrade del piano o acquista un add-on.`,
              code: 'plan-limit',
              limit: limits.maxStudents,
              current: currentActive,
              requested: toActivate,
            },
            { status: 403 }
          );
        }
      }
    }

    let result;
    switch (action) {
      case 'activate':
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'deactivate':
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'INACTIVE' },
        });
        break;

      case 'suspend':
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'SUSPENDED' },
        });
        break;

      case 'delete':
        // Soft delete by setting status to INACTIVE
        result = await prisma.student.updateMany({
          where: {
            id: { in: studentIds },
            tenantId: session.user.tenantId,
          },
          data: { status: 'INACTIVE' },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Azione non supportata' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Azione '${action}' completata per ${result.count} studenti`,
      count: result.count,
    });
  } catch (error) {
    const authRes = authError(error);
    if (authRes) return authRes;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in bulk student action:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
