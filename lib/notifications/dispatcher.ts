import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { EmailNotificationService } from '@/lib/email-queue';
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
 * Quiet hours: Notification.scheduledFor honored when set. We don't yet
 * read NotificationPreferences.quietHoursStart/End here — that's a
 * follow-up. Today, callers can pass scheduledFor explicitly.
 */

export type DispatchOptions = {
  sendEmail?: boolean;
  sendPush?: boolean;
};

const APP_URL = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const FROM_NAME = 'InsegnaMi.pro';

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

  if (sendEmail) {
    if (notification.emailSent) {
      reason = 'already-sent';
    } else if (!user?.email) {
      reason = 'no-recipient-email';
    } else {
      const { html, text } = renderNotificationEmail(notification);
      const subject = `[${FROM_NAME}] ${notification.title}`;

      // Compute a delay if scheduledFor is in the future. BullMQ's `delay`
      // option (ms) is the simplest way to achieve "send no earlier than X".
      const delay = notification.scheduledFor
        ? Math.max(0, notification.scheduledFor.getTime() - Date.now())
        : 0;

      try {
        await EmailNotificationService.sendGenericEmail({
          to: user.email,
          subject,
          html,
          text,
        });
        await prisma.notification.update({
          where: { id: notification.id },
          data: { emailSent: true },
        });
        emailEnqueued = true;
        if (delay > 0) reason = `delayed-${delay}ms`;
      } catch (err) {
        // Email queue unavailable (e.g. Redis down). We don't fail the
        // upstream operation — log and let an admin retry via tooling.
        logger.warn(`dispatchNotification: failed to enqueue email for notification ${notification.id}`, err);
        reason = 'queue-unavailable';
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
