import nodemailer from 'nodemailer';
import { SMTP_CONFIG, EMAIL_FROM } from '@/lib/config';

// Create transporter only if not in build mode
let transporter: nodemailer.Transporter | null = null;

// Initialize transporter safely
function initializeTransporter() {
  try {
    // Skip email setup during build or if no config
    if (process.env.NEXT_PHASE === 'phase-production-build' || 
        process.env.NODE_ENV === 'production' && !SMTP_CONFIG.host) {
      console.log('⚠️ Skipping email transporter during build');
      return;
    }

    if (SMTP_CONFIG.host && SMTP_CONFIG.auth.user) {
      transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: false,
        auth: SMTP_CONFIG.auth,
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Only verify in development
      if (process.env.NODE_ENV === 'development' && transporter) {
        transporter.verify((error: any, success: boolean) => {
          if (error) {
            console.error('❌ Email transporter error:', error);
          } else {
            console.log('✅ Email server is ready to take messages');
          }
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Email transporter initialization failed:', error);
  }
}

// Initialize only if not building
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  initializeTransporter();
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
  async sendEmail(options: EmailOptions) {
    try {
      // Check if transporter is available
      if (!transporter) {
        console.warn('⚠️ Email transporter not available, skipping email send');
        return {
          success: false,
          error: 'Email transporter not configured',
        };
      }

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

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
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
