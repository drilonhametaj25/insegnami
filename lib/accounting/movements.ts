import type { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '@/lib/logger';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Centralised helpers that maintain AccountingMovement rows in lock-step
 * with the events they describe. Every callsite that mutates the
 * "fiscal-relevant" state of a Payment, Payroll or Subscription should
 * route through here so the P&L stays consistent.
 *
 * Idempotency rule: every helper is "create-if-missing". The schema does
 * NOT impose a unique constraint on (refType, refId) because some refs
 * legitimately produce multiple movements (a refund pairs with the
 * original payment). Idempotency lives in the helpers via lookup.
 */

export async function recordPaymentRevenue(
  tx: Tx,
  args: { tenantId: string; paymentId: string; amount: number; date: Date; description?: string; studentId?: string; classId?: string },
): Promise<{ movementId: string; created: boolean }> {
  const existing = await tx.accountingMovement.findFirst({
    where: { tenantId: args.tenantId, paymentId: args.paymentId, source: 'PAYMENT', type: 'REVENUE' },
    select: { id: true },
  });
  if (existing) return { movementId: existing.id, created: false };

  const movement = await tx.accountingMovement.create({
    data: {
      tenantId: args.tenantId,
      date: args.date,
      type: 'REVENUE',
      source: 'PAYMENT',
      category: 'rette',
      amount: new Decimal(args.amount),
      currency: 'EUR',
      description: args.description ?? `Incasso pagamento ${args.paymentId}`,
      paymentId: args.paymentId,
      studentId: args.studentId,
      classId: args.classId,
    },
    select: { id: true },
  });
  return { movementId: movement.id, created: true };
}

/**
 * Best-effort: when a Payment.status flips to PAID we record the revenue.
 * The flip happens inside the existing /api/payments routes; we expose
 * this helper so route handlers can opt in by importing + calling rather
 * than duplicating the lookup logic in each.
 */
export async function syncPaymentMovement(
  tx: Tx,
  paymentId: string,
): Promise<{ movementId: string | null; reason: 'created' | 'already-exists' | 'not-paid' | 'not-found' }> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true, tenantId: true, status: true, amount: true,
      paidDate: true, dueDate: true, description: true,
      studentId: true, classId: true,
    },
  });
  if (!payment) return { movementId: null, reason: 'not-found' };
  if (payment.status !== 'PAID') return { movementId: null, reason: 'not-paid' };

  try {
    const result = await recordPaymentRevenue(tx, {
      tenantId: payment.tenantId,
      paymentId: payment.id,
      amount: Number(payment.amount),
      date: payment.paidDate ?? payment.dueDate,
      description: payment.description,
      studentId: payment.studentId,
      classId: payment.classId ?? undefined,
    });
    return { movementId: result.movementId, reason: result.created ? 'created' : 'already-exists' };
  } catch (err) {
    logger.warn(`syncPaymentMovement failed for ${paymentId}`, err);
    return { movementId: null, reason: 'not-found' };
  }
}

/**
 * Reversal helper: when a Payment goes from PAID back to PENDING/OVERDUE
 * (rare but happens when an admin corrects an entry), we delete the
 * existing AccountingMovement so the P&L doesn't double-count.
 */
export async function reversePaymentMovement(
  tx: Tx,
  paymentId: string,
): Promise<{ deleted: boolean }> {
  const result = await tx.accountingMovement.deleteMany({
    where: { paymentId, source: 'PAYMENT', type: 'REVENUE' },
  });
  return { deleted: result.count > 0 };
}
