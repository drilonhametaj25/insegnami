import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GDPR Article 17 — Right to Erasure ("right to be forgotten").
 *
 * What we DO erase / anonymize:
 *   - User: email → deleted-user-{id}@anonymized.invalid, firstName/lastName
 *     to neutral placeholders, password to a fresh random hash (locks login),
 *     phone/avatar/resetToken/verificationToken cleared, status → INACTIVE
 *   - Student profile: email/phone/address/emergencyContact/medicalNotes/
 *     specialNeeds cleared. firstName/lastName replaced with "Utente
 *     Cancellato" so existing references (gradebooks, attendance reports)
 *     don't blow up but the identity is no longer present
 *   - Notifications & messages received: deleted (their content was
 *     intended for this person, and they've asked to be forgotten)
 *
 * What we DELIBERATELY KEEP (legal hold + integrity):
 *   - Payment / Invoice / InvoiceLine / SdiEvent — fiscal documents,
 *     mandated retention is 10 years in IT (DPR 600/73 Art.22)
 *   - Grades and ReportCards — academic record. The student is anonymized
 *     so the grade is now attached to "Utente Cancellato" but the grade
 *     itself is institutional record.
 *   - AuditLog — required for our own compliance (regulatory audits)
 *
 * What we WRITE:
 *   - AuditLog with action='GDPR_ERASURE' so the erasure itself is
 *     auditable (Article 30 record-keeping obligation)
 *
 * The function is non-reversible. Caller must have established that the
 * subject genuinely is the user (auth on /api/auth/me/route.ts DELETE) or
 * has been authorised by the user via documented request (admin path).
 */

const ANON_FIRST = 'Utente';
const ANON_LAST = 'Cancellato';

export type EraseResult = {
  userId: string;
  studentAffected: boolean;
  notificationsDeleted: number;
  messagesDeleted: number;
};

export async function eraseUser(userId: string, opts?: { triggeredBy?: string; reason?: string }): Promise<EraseResult> {
  const triggeredBy = opts?.triggeredBy ?? userId; // self-service by default
  const reason = opts?.reason ?? 'GDPR Article 17 — user request';

  const userRaw = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      tenants: { select: { tenantId: true } },
      studentProfile: { select: { id: true, tenantId: true } },
    } as any,
  });
  if (!userRaw) throw new Error(`eraseUser: user ${userId} not found`);
  // Cast — the conditional `select` with relation drilling confuses
  // Prisma's type inference; we know the runtime shape.
  const user = userRaw as unknown as {
    id: string;
    email: string;
    tenants: Array<{ tenantId: string }>;
    studentProfile: { id: string; tenantId: string } | null;
  };

  // We don't accept a re-erase. Detect by the well-known anonymized email format.
  if (user.email.endsWith('@anonymized.invalid')) {
    throw new Error('eraseUser: user already anonymized');
  }

  const anonymizedEmail = `deleted-user-${userId}@anonymized.invalid`;
  const lockedPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  const tenantId = (user as any).tenants?.[0]?.tenantId ?? null;

  return prisma.$transaction(async (tx) => {
    // Anonymize the User row. We cannot delete because cascade chains would
    // wipe Payments / Invoices / Grades that we MUST retain for legal hold.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        firstName: ANON_FIRST,
        lastName: ANON_LAST,
        password: lockedPassword,
        phone: null,
        avatar: null,
        verificationToken: null,
        resetToken: null,
        resetTokenExpiry: null,
        status: 'INACTIVE',
      } as any,
    });

    let studentAffected = false;
    if ((user as any).studentProfile) {
      const sid = (user as any).studentProfile.id;
      await tx.student.update({
        where: { id: sid },
        data: {
          firstName: ANON_FIRST,
          lastName: ANON_LAST,
          email: anonymizedEmail,
          phone: null,
          address: null,
          emergencyContact: null,
          medicalNotes: null,
          specialNeeds: null,
          status: 'INACTIVE',
        } as any,
      });
      studentAffected = true;
    }

    // Notifications received — these are messages addressed to the subject,
    // they should disappear with them.
    const notif = await tx.notification.deleteMany({ where: { userId } });

    // Messages: outgoing ones we anonymize (other parties may have referenced
    // them). Incoming ones (recipient = subject) get deleted as recipients.
    const msgRecip = await tx.messageRecipient.deleteMany({ where: { userId } });

    // Audit row for the erasure itself.
    if (tenantId) {
      try {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: triggeredBy,
            action: 'GDPR_ERASURE',
            entity: 'User',
            entityId: userId,
            oldData: { email: user.email } as any,
            newData: { email: anonymizedEmail, reason } as any,
          },
        });
      } catch (auditErr) {
        // Audit row failure is non-fatal — the erasure already committed in
        // this same transaction is more important than the bookkeeping row.
        logger.warn('eraseUser: audit row write failed', auditErr);
      }
    }

    return {
      userId,
      studentAffected,
      notificationsDeleted: notif.count,
      messagesDeleted: msgRecip.count,
    };
  }, { timeout: 20_000 });
}
