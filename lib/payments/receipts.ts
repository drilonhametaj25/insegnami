import { prisma } from '@/lib/db';

/**
 * C6 — Ricevuta di pagamento: notifica in-app + email (sendEmail: true) allo
 * user dello studente e, se collegato, al parentUser. Best-effort: qualsiasi
 * errore viene loggato e NON deve mai far fallire la richiesta chiamante
 * (il pagamento è già committato quando questa funzione parte).
 *
 * Estratta dalle route /api/payments (era duplicata nei due file route, che
 * non possono esportare helper condivisi). Usata anche dal webhook Stripe.
 */
export async function sendPaymentReceipt(payment: {
  id: string;
  tenantId: string;
  studentId: string;
  amount: unknown;
  description: string;
  paidDate?: Date | null;
}) {
  try {
    const { createAndDispatch } = await import('@/lib/notifications/dispatcher');

    // userId è obbligatorio su Student, parentUserId opzionale
    const student = await prisma.student.findFirst({
      where: { id: payment.studentId },
      select: { userId: true, parentUserId: true },
    });
    if (!student) return;

    // Importo in formato italiano (es. 1.250,00) e data del pagamento
    const importo = Number(payment.amount).toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const dataPagamento = (payment.paidDate ?? new Date()).toLocaleDateString('it-IT');
    const base = {
      tenantId: payment.tenantId,
      title: 'Ricevuta di pagamento',
      content: `Abbiamo registrato il pagamento di € ${importo} — "${payment.description}" — in data ${dataPagamento}. Questa notifica vale come ricevuta.`,
      type: 'PAYMENT' as const,
      sourceType: 'Payment',
      sourceId: payment.id,
    };

    // Ricevuta allo studente
    await createAndDispatch(
      { ...base, userId: student.userId, actionUrl: '/dashboard/student' },
      { sendEmail: true },
    );

    // Ricevuta al genitore, se esiste un account collegato
    if (student.parentUserId) {
      await createAndDispatch(
        { ...base, userId: student.parentUserId, actionUrl: '/dashboard/parent' },
        { sendEmail: true },
      );
    }
  } catch (error) {
    // Fire-and-forget: logghiamo e basta, niente throw verso il chiamante
    console.error('Errore invio ricevuta di pagamento (non bloccante):', error);
  }
}
