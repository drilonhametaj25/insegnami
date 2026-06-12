import nodemailer from 'nodemailer';
import { SMTP_CONFIG, EMAIL_FROM } from '@/lib/config';
import { EmailNotificationService } from '@/lib/email-queue';
import { logger } from '@/lib/logger';

// Transporter SMTP lazy: creato alla PRIMA sendEmail che ne ha bisogno,
// mai al caricamento del modulo (le route Next importano questo file).
let transporter: nodemailer.Transporter | null = null;
let transporterInitAttempted = false;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (transporterInitAttempted) return null; // config assente: inutile riprovare
  transporterInitAttempted = true;

  try {
    if (!SMTP_CONFIG.host || !SMTP_CONFIG.auth.user) {
      return null;
    }

    transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.port === 465, // true per SSL (porta 465 Aruba)
      auth: SMTP_CONFIG.auth,
      tls: {
        rejectUnauthorized: false,
      },
    });

    // verify() promisificata e loggata anche in produzione, ma NON bloccante:
    // l'invio non aspetta l'esito della verifica.
    void Promise.resolve(transporter.verify())
      .then(() => logger.info('Email transporter verificato: SMTP pronto'))
      .catch((error) => logger.error('Verifica email transporter fallita', error));

    return transporter;
  } catch (error) {
    logger.warn('Inizializzazione email transporter fallita', error);
    return null;
  }
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    path?: string;
  }>;
}

export class EmailService {
  /**
   * Strategia queue-first: con Redis configurato l'email viene accodata su
   * BullMQ (la consuma il processo worker dedicato). Se la coda non è
   * disponibile si fa fallback sull'invio SMTP diretto. Se nessuno dei due
   * canali è disponibile, l'errore viene loggato esplicitamente.
   *
   * @param useQueue passare false per forzare l'invio SMTP diretto
   *                 (es. dal worker stesso, per evitare loop di accodamento)
   */
  async sendEmail(options: EmailOptions, useQueue: boolean = true) {
    // 1) Tentativo queue-first
    if (useQueue && process.env.REDIS_URL) {
      try {
        await EmailNotificationService.sendGenericEmail({
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments?.map(a => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        });
        return {
          success: true,
          queued: true,
          message: 'Email queued for delivery',
        };
      } catch (queueError) {
        logger.warn('Accodamento email fallito, fallback su SMTP diretto', queueError);
        // prosegue col fallback SMTP qui sotto
      }
    }

    // 2) Fallback (o invio primario senza Redis): SMTP diretto
    const smtpTransporter = getTransporter();
    if (!smtpTransporter) {
      logger.error(
        'Invio email impossibile: né coda BullMQ né SMTP disponibili. ' +
        'Configurare REDIS_URL e/o SMTP_HOST + SMTP_USER.',
        { to: options.to, subject: options.subject }
      );
      return {
        success: false,
        queued: false,
        error: 'No email channel available (queue and SMTP both unavailable)',
      };
    }

    try {
      const mailOptions = {
        from: options.from || EMAIL_FROM,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(',') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc) : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments,
      };

      const result = await smtpTransporter.sendMail(mailOptions);
      logger.info('Email inviata via SMTP diretto', { messageId: result.messageId });
      return {
        success: true,
        queued: false,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      logger.error('Invio email SMTP fallito', error);
      return {
        success: false,
        queued: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Template methods for common email types
  async sendWelcomeEmail(to: string, firstName: string, tenantName: string) {
    const html = this.generateWelcomeTemplate(firstName, tenantName);
    return this.sendEmail({
      to,
      subject: `Benvenuto in ${tenantName}!`,
      html,
    });
  }

  async sendPasswordResetEmail(to: string, firstName: string, resetUrl: string) {
    const html = this.generatePasswordResetTemplate(firstName, resetUrl);
    return this.sendEmail({
      to,
      subject: 'Reset della password richiesto',
      html,
    });
  }

  async sendAttendanceNotification(to: string, studentName: string, className: string, status: string) {
    const html = this.generateAttendanceTemplate(studentName, className, status);
    return this.sendEmail({
      to,
      subject: `Notifica presenze - ${studentName}`,
      html,
    });
  }

  async sendPaymentReminder(to: string, studentName: string, amount: number, dueDate: Date) {
    const html = this.generatePaymentReminderTemplate(studentName, amount, dueDate);
    return this.sendEmail({
      to,
      subject: `Promemoria pagamento - ${studentName}`,
      html,
    });
  }

  async sendNoticeEmail(to: string, title: string, content: string, tenantName: string) {
    const html = this.generateNoticeTemplate(title, content, tenantName);
    return this.sendEmail({
      to,
      subject: title,
      html,
    });
  }

  // Email template generators
  private generateWelcomeTemplate(firstName: string, tenantName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Benvenuto</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0ea5e9; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Benvenuto in ${tenantName}!</h1>
          </div>
          <div class="content">
            <p>Ciao ${firstName},</p>
            <p>Benvenuto nella nostra piattaforma di gestione scolastica! Il tuo account è stato creato con successo.</p>
            <p>Potrai accedere al sistema per:</p>
            <ul>
              <li>Visualizzare le tue lezioni</li>
              <li>Controllare le presenze</li>
              <li>Ricevere comunicazioni</li>
              <li>Accedere ai materiali didattici</li>
            </ul>
            <p>Se hai domande, non esitare a contattarci.</p>
          </div>
          <div class="footer">
            <p>© 2024 ${tenantName}. Tutti i diritti riservati.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetTemplate(firstName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reset Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Password</h1>
          </div>
          <div class="content">
            <p>Ciao ${firstName},</p>
            <p>Hai richiesto il reset della tua password. Clicca sul pulsante qui sotto per reimpostare la tua password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Se non hai richiesto questo reset, ignora questa email.</p>
            <p>Il link scadrà tra 1 ora.</p>
          </div>
          <div class="footer">
            <p>© 2024 InsegnaMi.pro. Tutti i diritti riservati.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAttendanceTemplate(studentName: string, className: string, status: string): string {
    const statusColor = status === 'PRESENT' ? '#10b981' : status === 'LATE' ? '#f59e0b' : '#ef4444';
    const statusText = status === 'PRESENT' ? 'Presente' : status === 'LATE' ? 'In ritardo' : 'Assente';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Notifica Presenze</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .status { display: inline-block; padding: 8px 16px; background-color: ${statusColor}; color: white; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Notifica Presenze</h1>
          </div>
          <div class="content">
            <p>Notifica per: <strong>${studentName}</strong></p>
            <p>Classe: <strong>${className}</strong></p>
            <p>Status: <span class="status">${statusText}</span></p>
            <p>Data: ${new Date().toLocaleDateString('it-IT')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentReminderTemplate(studentName: string, amount: number, dueDate: Date): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Promemoria Pagamento</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .amount { font-size: 24px; font-weight: bold; color: #0ea5e9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Promemoria Pagamento</h1>
          </div>
          <div class="content">
            <p>Studente: <strong>${studentName}</strong></p>
            <p>Importo da pagare: <span class="amount">€${amount.toFixed(2)}</span></p>
            <p>Scadenza: <strong>${dueDate.toLocaleDateString('it-IT')}</strong></p>
            <p>Ti ricordiamo di effettuare il pagamento entro la scadenza indicata.</p>
            <p>Per ulteriori informazioni, contatta la segreteria.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateNoticeTemplate(title: string, content: string, tenantName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0ea5e9; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>© 2024 ${tenantName}. Tutti i diritti riservati.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();

// Export a simple sendEmail function for backward compatibility
export const sendEmail = (options: EmailOptions) => emailService.sendEmail(options);

export default emailService;
