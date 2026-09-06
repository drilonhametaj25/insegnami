import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { isPackageLowOnHours } from '@/lib/hours-package-service';
import { logger } from '@/lib/logger';

/**
 * Notifiche low-hours estratte dalla vecchia route attendance (il consumo
 * ore ora passa SOLO da lib/hours/consume.ts). Best-effort: nessun errore
 * di invio deve propagarsi al chiamante.
 */

type LowHoursPkg = {
  id: string;
  remainingHours: unknown;
  totalHours: unknown;
  student: { firstName: string; lastName: string; email: string | null };
  course: { name: string };
};

/** Email "pacchetto ore in esaurimento" per un singolo pacchetto. */
export async function sendLowHoursEmail(pkg: LowHoursPkg): Promise<void> {
  if (!pkg.student.email) return;

  const remainingHours = Number(pkg.remainingHours);
  const totalHours = Number(pkg.totalHours);
  const percentageRemaining = ((remainingHours / totalHours) * 100).toFixed(0);

  const subject = `⚠️ Pacchetto Ore in Esaurimento - ${pkg.course.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">⚠️ Attenzione: Pacchetto Ore in Esaurimento</h2>
      <p>Gentile ${pkg.student.firstName} ${pkg.student.lastName},</p>
      <p>Ti informiamo che il tuo pacchetto ore per il corso <strong>${pkg.course.name}</strong> sta per esaurirsi.</p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #92400e;">Riepilogo Ore</h3>
        <p style="margin: 5px 0;"><strong>Ore Rimanenti:</strong> ${remainingHours.toFixed(1)} ore</p>
        <p style="margin: 5px 0;"><strong>Ore Totali:</strong> ${totalHours.toFixed(1)} ore</p>
        <p style="margin: 5px 0;"><strong>Percentuale Rimanente:</strong> ${percentageRemaining}%</p>
      </div>
      <p>Ti consigliamo di contattare la segreteria per rinnovare il tuo pacchetto ore e continuare le lezioni senza interruzioni.</p>
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Visualizza Dashboard
        </a>
      </p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 12px;">
        Questo è un messaggio automatico. Per qualsiasi domanda, contatta la segreteria.
      </p>
    </div>
  `;

  await sendEmail({ to: pkg.student.email, subject, html });
}

/**
 * Invia la notifica low-hours agli studenti indicati (tipicamente i
 * lowPackageStudentIds restituiti da consumeHoursForLesson). Carica i
 * pacchetti del corso ancora in soglia e manda un'email per ciascuno.
 * Ritorna il numero di email inviate.
 */
export async function notifyLowHoursStudents(
  tenantId: string,
  courseId: string,
  studentIds: string[],
): Promise<number> {
  if (studentIds.length === 0) return 0;

  let sent = 0;
  try {
    const packages = await prisma.hoursPackage.findMany({
      where: {
        tenantId,
        courseId,
        studentId: { in: studentIds },
      },
      include: {
        student: { select: { firstName: true, lastName: true, email: true } },
        course: { select: { name: true } },
      },
    });

    for (const pkg of packages) {
      if (!isPackageLowOnHours(Number(pkg.remainingHours), Number(pkg.totalHours))) continue;
      try {
        await sendLowHoursEmail(pkg);
        sent += 1;
      } catch (err) {
        logger.warn(`notifyLowHoursStudents: invio fallito per pacchetto ${pkg.id}`, err);
      }
    }
  } catch (err) {
    logger.warn('notifyLowHoursStudents: lookup pacchetti fallito', err);
  }
  return sent;
}
