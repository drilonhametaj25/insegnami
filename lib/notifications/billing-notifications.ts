import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAndDispatch } from '@/lib/notifications/dispatcher';
import type { NotificationPriority, NotificationType } from '@prisma/client';

/**
 * Notifiche commerciali/billing verso gli amministratori di un tenant
 * (attivazione abbonamento, cambio piano, pagamento fallito, fine prova).
 *
 * Contratto: questa funzione NON lancia MAI. Viene invocata fire-and-forget
 * dal webhook Stripe (che ritorna 500 sugli errori genuini per far ritentare
 * Stripe) e dai cron — un errore SMTP/DB qui non deve trasformarsi in un
 * retry storm. In caso di errore logga e ritorna il conteggio parziale (o 0).
 */

export type TenantAdminNotification = {
  title: string;
  content: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  type?: NotificationType;
  sourceType?: string;
  sourceId?: string;
};

/**
 * Notifica tutti gli ADMIN/DIRECTOR del tenant: riga Notification in-app +
 * email transazionale (via dispatcher; è lui a gestire utenti senza email).
 * Ritorna il numero di amministratori notificati con successo.
 */
export async function notifyTenantAdmins(
  tenantId: string,
  input: TenantAdminNotification,
): Promise<number> {
  try {
    // Filtro per ruolo direttamente in query: solo chi può agire sul billing
    const admins = await prisma.userTenant.findMany({
      where: {
        tenantId,
        role: { in: ['ADMIN', 'DIRECTOR'] },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    let notified = 0;
    for (const admin of admins) {
      try {
        // createAndDispatch crea sempre la riga in-app; l'email parte solo
        // se l'utente ha un indirizzo (reason 'no-recipient-email' altrimenti)
        await createAndDispatch(
          {
            tenantId,
            userId: admin.userId,
            title: input.title,
            content: input.content,
            type: input.type ?? 'SYSTEM',
            priority: input.priority ?? 'NORMAL',
            actionUrl: input.actionUrl,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
          },
          { sendEmail: true },
        );
        notified++;
      } catch (err) {
        // Un destinatario fallito non blocca gli altri
        logger.warn(
          `notifyTenantAdmins: dispatch fallito per user ${admin.userId} (tenant ${tenantId})`,
          err,
        );
      }
    }
    return notified;
  } catch (err) {
    // Mai propagare: il chiamante è fire-and-forget per design
    logger.error(`notifyTenantAdmins: errore per tenant ${tenantId}`, err);
    return 0;
  }
}
