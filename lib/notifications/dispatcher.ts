import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { EmailNotificationService } from '@/lib/email-queue';
import { rateLimitByKey } from '@/lib/rate-limit';
import type { Notification, NotificationType, NotificationPriority } from '@prisma/client';
import { escapeHtml } from '@/lib/api-middleware';

/**
 * Notification dispatcher — single chokepoint that turns Notification rows
 * into actual delivery (email today, push when implemented).
 *
 * Why this exists: before this module, /api/notifications and
 * NotificationService both wrote rows with `emailSent: <flag>` but never
 * enqueued the email job. The Notification row sat in the DB forever and
 * the recipient saw nothing. This dispatcher closes the loop:
 *   1. write Notification row (already done by caller or by this module)
 *   2. enqueue email job through EmailNotificationService.sendGenericEmail
 *   3. flip emailSent=true once enqueued (delivery success/failure is
 *      observed via emailWorker logs and BullMQ retries — we don't
 *      block the request waiting for SMTP).
 *
 * NotificationPreferences (rispettate qui, unico chokepoint):
 *   - emailEnabled=false        → nessuna email (la notifica in-app resta)
 *   - typePreferences[type]=false → email saltata per quel tipo
 *   - quiet hours attive        → invio posticipato (delay BullMQ) e
 *     scheduledFor della riga aggiornato di conseguenza
 *
 * Coda non disponibile (niente REDIS_URL / Redis giù): fallback SMTP diretto
 * via EmailService (useQueue=false) + registrazione EmailLog.
 */

export type DispatchOptions = {
  sendEmail?: boolean;
  sendPush?: boolean;
};

const APP_URL = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const FROM_NAME = 'InsegnaMi.pro';

// B3.4: quota per-tenant anti-DoS sull'enqueue email — max email/ora per
// tenant. Riusa rateLimitByKey (sliding window su Redis, fail-open se giù).
const EMAIL_QUEUE_MAX_PER_HOUR = 500;
const EMAIL_QUEUE_WINDOW_MS = 3600000;

/**
 * Millisecondi di attesa per uscire dalle quiet hours dell'utente.
 * Ritorna 0 se `now` è fuori dalla finestra (o input invalido). Gestisce le
 * finestre a cavallo di mezzanotte (es. 22:00 → 08:00). Il confronto avviene
 * nell'orario civile del fuso indicato (default Europe/Rome).
 */
export function quietHoursDelayMs(
  now: Date,
  start: string | null | undefined,
  end: string | null | undefined,
  tz = 'Europe/Rome',
): number {
  if (!start || !end) return 0;
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin === null || endMin === null || startMin === endMin) return 0;

  const fmt = new Intl.DateTimeFormat('it-IT', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = fmt.format(now).split(':').map(Number);
  const nowMin = h * 60 + m;

  if (startMin < endMin) {
    // Finestra nello stesso giorno (es. 13:00 → 15:00)
    if (nowMin >= startMin && nowMin < endMin) return (endMin - nowMin) * 60_000;
    return 0;
  }
  // Finestra a cavallo di mezzanotte (es. 22:00 → 08:00)
  if (nowMin >= startMin) return ((24 * 60 - nowMin) + endMin) * 60_000;
  if (nowMin < endMin) return (endMin - nowMin) * 60_000;
  return 0;
}

function priorityLabel(priority: NotificationPriority): { color: string; label: string } {
  switch (priority) {
    case 'URGENT': return { color: '#dc2626', label: 'URGENTE' };
    case 'HIGH':   return { color: '#ea580c', label: 'IMPORTANTE' };
    case 'LOW':    return { color: '#64748b', label: 'INFO' };
    default:       return { color: '#0ea5e9', label: 'NOTIFICA' };
  }
}

/**
 * Render a Notification row into transactional email HTML.
 * The branding is intentionally minimal — keep it portable so plain-text
 * email clients still get something legible.
 */
function renderNotificationEmail(notif: Pick<Notification, 'title' | 'content' | 'priority' | 'actionUrl' | 'actionLabel'>): { html: string; text: string } {
  const safeTitle = escapeHtml(notif.title);
  const safeContent = escapeHtml(notif.content);
  const meta = priorityLabel(notif.priority);

  const ctaButton = notif.actionUrl
    ? `<div style="text-align:center;margin:28px 0">
         <a href="${escapeHtml(notif.actionUrl.startsWith('http') ? notif.actionUrl : `${APP_URL}${notif.actionUrl}`)}"
            style="background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;font-weight:600">
           ${escapeHtml(notif.actionLabel || 'Apri InsegnaMi.pro')}
         </a>
       </div>`
    : '';

  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:${meta.color};color:#fff;padding:14px 24px;font-size:11px;font-weight:700;letter-spacing:.5px">
      ${meta.label}
    </div>
    <div style="padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px 0;color:#0f172a">${safeTitle}</h1>
      <div style="font-size:15px;line-height:1.6;color:#334155;white-space:pre-wrap">${safeContent}</div>
      ${ctaButton}
    </div>
    <div style="background:#f8fafc;padding:14px 24px;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0">
      ${FROM_NAME} · <a href="${APP_URL}" style="color:#0ea5e9;text-decoration:none">${APP_URL.replace(/^https?:\/\//, '')}</a>
    </div>
  </div>
</body></html>`;

  const ctaLink = notif.actionUrl
    ? `\n\n${notif.actionLabel || 'Apri'}: ${notif.actionUrl.startsWith('http') ? notif.actionUrl : `${APP_URL}${notif.actionUrl}`}`
    : '';
  const text = `${notif.title}\n\n${notif.content}${ctaLink}\n\n— ${FROM_NAME}`;

  return { html, text };
}

/**
 * Fallback SMTP diretto quando la coda BullMQ non è disponibile: riusa il
 * canale diretto di EmailService (useQueue=false, stesso pattern di
 * lib/email.ts) e registra l'esito su EmailLog. Non lancia mai.
 */
async function sendViaSmtpFallback(
  notification: Notification,
  payload: { to: string; subject: string; html: string; text: string; meta?: { tenantId?: string; sourceType?: string; sourceId?: string } },
): Promise<{ sent: boolean; reason: string }> {
  let sent = false;
  let errorMsg: string | null = null;
  try {
    // Import lazy: evita di pagare nodemailer sulle route che non inviano
    const { emailService } = await import('@/lib/email');
    const res = await emailService.sendEmail(
      { to: payload.to, subject: payload.subject, html: payload.html, text: payload.text },
      false, // niente coda: SMTP diretto
    );
    sent = !!res?.success;
    if (!sent) errorMsg = (res as any)?.error ?? 'smtp fallback failed';
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(`dispatchNotification: fallback SMTP fallito per notifica ${notification.id}`, err);
  }

  // EmailLog anche dal fallback (best-effort)
  try {
    await prisma.emailLog.create({
      data: {
        tenantId: payload.meta?.tenantId ?? notification.tenantId,
        to: payload.to,
        subject: payload.subject,
        sourceType: payload.meta?.sourceType ?? 'notification',
        sourceId: payload.meta?.sourceId ?? notification.id,
        status: sent ? 'SENT' : 'FAILED',
        sentAt: sent ? new Date() : null,
        error: errorMsg,
      },
    });
  } catch (err) {
    logger.warn('dispatchNotification: scrittura EmailLog dal fallback fallita', err);
  }

  if (sent) {
    try {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true },
      });
    } catch (err) {
      logger.warn('dispatchNotification: update emailSent dal fallback fallita', err);
    }
    return { sent: true, reason: 'smtp-fallback' };
  }
  return { sent: false, reason: 'queue-unavailable' };
}

/**
 * Dispatch an existing Notification row through the configured channels.
 * Idempotent on the email side: if emailSent is already true, skip.
 *
 * Returns counters so callers can log/report.
 */
export async function dispatchNotification(
  notification: Notification & { user?: { email: string | null } | null },
  options: DispatchOptions = {},
): Promise<{ emailEnqueued: boolean; pushEnqueued: boolean; reason?: string }> {
  const sendEmail = options.sendEmail ?? false;
  const sendPush = options.sendPush ?? false;

  let user = notification.user;
  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true },
    });
  }

  let emailEnqueued = false;
  let reason: string | undefined;

  // Preferenze utente: lette una volta, best-effort (in assenza di riga
  // valgono i default: email abilitate, nessuna quiet hour).
  let prefs: {
    emailEnabled: boolean;
    typePreferences: unknown;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  } | null = null;
  if (sendEmail) {
    try {
      prefs = await prisma.notificationPreferences.findUnique({
        where: { userId: notification.userId },
        select: {
          emailEnabled: true,
          typePreferences: true,
          quietHoursEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
        },
      });
    } catch (err) {
      logger.warn('dispatchNotification: lettura NotificationPreferences fallita', err);
    }
  }

  const typePrefs = (prefs?.typePreferences ?? null) as Record<string, boolean> | null;

  if (sendEmail) {
    if (notification.emailSent) {
      reason = 'already-sent';
    } else if (!user?.email) {
      reason = 'no-recipient-email';
    } else if (prefs && prefs.emailEnabled === false) {
      // Preferenza esplicita: niente email — la notifica in-app resta
      reason = 'email-disabled';
    } else if (typePrefs && typePrefs[notification.type] === false) {
      // Tipo disattivato dall'utente
      reason = 'type-disabled';
    } else if (!(await rateLimitByKey(notification.tenantId, EMAIL_QUEUE_MAX_PER_HOUR, EMAIL_QUEUE_WINDOW_MS, 'rl:queue:email'))) {
      // B3.4: quota tenant esaurita — la notifica resta in-app (emailSent
      // false), nessun throw: un tenant rumoroso non deve saturare la coda.
      logger.warn(
        `dispatchNotification: quota email oraria esaurita per tenant ${notification.tenantId} — notifica ${notification.id} non accodata`,
      );
      reason = 'quota-exceeded';
    } else {
      const { html, text } = renderNotificationEmail(notification);
      const subject = `[${FROM_NAME}] ${notification.title}`;

      // Compute a delay if scheduledFor is in the future. BullMQ's `delay`
      // option (ms) is the simplest way to achieve "send no earlier than X".
      const now = Date.now();
      const scheduledDelay = notification.scheduledFor
        ? Math.max(0, notification.scheduledFor.getTime() - now)
        : 0;

      // Quiet hours: se attive e "adesso" cade nella finestra, l'invio viene
      // posticipato alla fine della finestra (vince il ritardo maggiore).
      const quietDelay = prefs?.quietHoursEnabled
        ? quietHoursDelayMs(new Date(now), prefs.quietHoursStart, prefs.quietHoursEnd)
        : 0;
      const delay = Math.max(scheduledDelay, quietDelay);
      const postponedTo = quietDelay > scheduledDelay ? new Date(now + quietDelay) : null;

      const emailPayload = {
        to: user.email,
        subject,
        html,
        text,
        meta: {
          tenantId: notification.tenantId,
          sourceType: notification.sourceType ?? 'notification',
          sourceId: notification.sourceId ?? notification.id,
        },
      };

      try {
        await EmailNotificationService.sendGenericEmail(emailPayload, { delay });
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            emailSent: true,
            // scheduledFor posticipato quando le quiet hours spostano l'invio
            ...(postponedTo ? { scheduledFor: postponedTo } : {}),
          },
        });
        emailEnqueued = true;
        if (delay > 0) reason = `delayed-${delay}ms`;
      } catch (err) {
        // Coda non disponibile (es. Redis giù / REDIS_URL assente):
        // fallback SMTP diretto — ma solo per invii immediati, perché senza
        // coda non possiamo posticipare.
        logger.warn(`dispatchNotification: failed to enqueue email for notification ${notification.id}`, err);
        if (delay > 0) {
          reason = 'queue-unavailable';
        } else {
          const fb = await sendViaSmtpFallback(notification, emailPayload);
          emailEnqueued = fb.sent;
          reason = fb.reason;
        }
      }
    }
  }

  // Push: schema has the flag but no provider yet. Stub for future.
  const pushEnqueued = false;
  if (sendPush) {
    // No-op until web-push / Firebase wiring lands. Keep the flag false
    // so analytics show genuine delivery state.
  }

  return { emailEnqueued, pushEnqueued, reason };
}

/**
 * One-shot helper: create the Notification row AND dispatch it.
 * Most callers in app code want this.
 */
export async function createAndDispatch(
  data: {
    tenantId: string;
    userId: string;
    title: string;
    content: string;
    type: NotificationType;
    priority?: NotificationPriority;
    actionUrl?: string;
    actionLabel?: string;
    sourceType?: string;
    sourceId?: string;
    scheduledFor?: Date;
    expiresAt?: Date;
  },
  options: DispatchOptions = {},
): Promise<{ notification: Notification; emailEnqueued: boolean }> {
  const notification = await prisma.notification.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId,
      title: data.title,
      content: data.content,
      type: data.type,
      priority: data.priority ?? 'NORMAL',
      actionUrl: data.actionUrl,
      actionLabel: data.actionLabel,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      scheduledFor: data.scheduledFor,
      expiresAt: data.expiresAt,
      emailSent: false,
      pushSent: false,
    },
  });

  const result = await dispatchNotification(notification, options);
  return { notification, emailEnqueued: result.emailEnqueued };
}
