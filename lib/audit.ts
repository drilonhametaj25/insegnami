import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface AuditEntry {
  tenantId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE';
  entity: string; // es. 'Payment', 'Invoice', 'Payroll'
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
  request?: Request;
}

/**
 * Scrive una riga di AuditLog. Estrazione del pattern inline usato per gli
 * studenti (BUG-047): da chiamare DENTRO la stessa transazione dell'operazione
 * tracciata, così l'audit non può divergere dal dato.
 */
export async function logAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      userId: entry.userId || 'unknown',
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldData: (entry.oldData ?? undefined) as any,
      newData: (entry.newData ?? undefined) as any,
      ipAddress:
        entry.request?.headers.get('x-forwarded-for') ||
        entry.request?.headers.get('x-real-ip') ||
        'unknown',
      userAgent: entry.request?.headers.get('user-agent') || 'unknown',
    },
  });
}
