import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { escapeHtml } from '@/lib/api-middleware';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate input
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Tutti i campi sono obbligatori' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email non valida' },
        { status: 400 }
      );
    }

    // Generate email HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Nuovo messaggio dal form contatti</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #e0e0e0; }
          .field { margin-bottom: 15px; }
          .field-label { font-weight: bold; color: #667eea; margin-bottom: 5px; }
          .field-value { background: white; padding: 10px; border-radius: 4px; border: 1px solid #e0e0e0; }
          .message-box { white-space: pre-wrap; }
          .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; background-color: #f0f0f0; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nuovo messaggio dal sito</h1>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">Nome:</div>
              <div class="field-value">${escapeHtml(name)}</div>
            </div>
            <div class="field">
              <div class="field-label">Email:</div>
              <div class="field-value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
            </div>
            <div class="field">
              <div class="field-label">Oggetto:</div>
              <div class="field-value">${escapeHtml(subject)}</div>
            </div>
            <div class="field">
              <div class="field-label">Messaggio:</div>
              <div class="field-value message-box">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
            </div>
          </div>
          <div class="footer">
            <p>Messaggio ricevuto da InsegnaMi.pro - Form Contatti</p>
            <p>Data: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to support
    const result = await emailService.sendEmail({
      to: 'info@drilonhametaj.it',
      subject: `[Contatti] ${escapeHtml(subject)}`,
      html: htmlContent,
      replyTo: email,
    });

    if (!result.success) {
      console.error('Failed to send contact email:', result.error);
      // Even if email fails, we return success to the user
      // In a production environment, you might want to queue the message
    }

    // Send confirmation email to the user
    const confirmationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Abbiamo ricevuto il tuo messaggio</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background-color: #f0f0f0; border-radius: 0 0 8px 8px; }
          .highlight { background-color: #f0f4ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Grazie per averci contattato!</h1>
          </div>
          <div class="content">
            <p>Ciao ${escapeHtml(name)},</p>
            <p>Abbiamo ricevuto il tuo messaggio e ti ringraziamo per aver contattato InsegnaMi.pro.</p>
            <div class="highlight">
              <p><strong>Il tuo messaggio:</strong></p>
              <p><em>"${escapeHtml(subject)}"</em></p>
            </div>
            <p>Il nostro team esaminerà la tua richiesta e ti risponderà entro <strong>24-48 ore lavorative</strong>.</p>
            <p>Nel frattempo, puoi:</p>
            <ul>
              <li>Visitare la nostra <a href="https://insegnami.pro/it/pricing">pagina prezzi</a></li>
              <li>Provare la <a href="https://insegnami.pro/auth/register">demo gratuita</a></li>
            </ul>
            <p>Cordiali saluti,<br>Il Team InsegnaMi.pro</p>
          </div>
          <div class="footer">
            <p>InsegnaMi.pro - La piattaforma di gestione scolastica</p>
            <p>P.IVA: 07327360488</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService.sendEmail({
      to: email,
      subject: 'Abbiamo ricevuto il tuo messaggio - InsegnaMi.pro',
      html: confirmationHtml,
    });

    return NextResponse.json({
      success: true,
      message: 'Messaggio inviato con successo',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'invio del messaggio' },
      { status: 500 }
    );
  }
}
