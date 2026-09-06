import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/email';
import { escapeHtml } from '@/lib/api-middleware';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Form contatti pubblico.
 *
 * Flusso: rate limit → parse → anti-spam (honeypot + tempo minimo) →
 * PERSISTENZA su ContactRequest → invio email. La riga a DB viene scritta
 * PRIMA delle email: se l'SMTP è giù il lead non va perso (è visibile
 * nella dashboard superadmin → Lead).
 */

// Locali pubblici validi: qualunque altro valore degrada a 'it'.
const VALID_LOCALES = new Set(['it', 'en', 'fr', 'pt']);

/** Risposta identica a quella di successo: i bot non devono capire di essere stati scartati. */
function fakeSuccess() {
  return NextResponse.json({
    success: true,
    message: 'Messaggio inviato con successo',
  });
}

export async function POST(request: NextRequest) {
  // Rate limit: i bot bombardano questo endpoint con payload malformati.
  const rl = await rateLimit(request, {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'rl:contact',
  });
  if (!rl.success) return rl.error!;

  // Body malformato (probe automatizzati) → 400, non 500.
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    school?: string;
    subject?: string;
    message?: string;
    locale?: string;
    source?: string;
    /** Honeypot: campo invisibile agli umani — se compilato è un bot. */
    website?: string;
    /** Timestamp (ms) di apertura del form: submit sotto i 3s = bot. */
    startedAt?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }

  // --- Anti-spam: rifiuto SILENZIOSO con 200 finto-ok ---
  // (a) honeypot compilato
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return fakeSuccess();
  }
  // (b) submit troppo rapido rispetto all'apertura del form (< 3s)
  if (body.startedAt !== undefined) {
    const startedAt = Number(body.startedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 3000) {
      return fakeSuccess();
    }
  }

  try {
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

    const locale = VALID_LOCALES.has(body.locale ?? '') ? body.locale! : 'it';

    // --- PERSISTENZA del lead PRIMA dell'invio email ---
    // Se l'email fallisce, la richiesta resta comunque tracciata a DB.
    await prisma.contactRequest.create({
      data: {
        name: name.slice(0, 200),
        email: email.slice(0, 200),
        phone: body.phone ? String(body.phone).slice(0, 50) : null,
        school: body.school ? String(body.school).slice(0, 200) : null,
        subject: subject.slice(0, 300),
        message: message.slice(0, 5000),
        locale,
        source: body.source ? String(body.source).slice(0, 100) : 'contact-form',
      },
    });

    // Destinatario lead: info@drilonhametaj.it è il default DELIBERATO
    // (decisione del titolare, set 2026) — CONTACT_TO_EMAIL può sovrascriverlo.
    // Il lead è comunque già persistito in contact_requests sopra.
    const contactTo = process.env.CONTACT_TO_EMAIL || 'info@drilonhametaj.it';

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
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #172554 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #e0e0e0; }
          .field { margin-bottom: 15px; }
          .field-label { font-weight: bold; color: #1e3a8a; margin-bottom: 5px; }
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
            ${body.phone ? `
            <div class="field">
              <div class="field-label">Telefono:</div>
              <div class="field-value">${escapeHtml(String(body.phone))}</div>
            </div>` : ''}
            ${body.school ? `
            <div class="field">
              <div class="field-label">Scuola:</div>
              <div class="field-value">${escapeHtml(String(body.school))}</div>
            </div>` : ''}
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
      to: contactTo,
      subject: `[Contatti] ${escapeHtml(subject)}`,
      html: htmlContent,
      replyTo: email,
    });

    if (!result.success) {
      console.error('Failed to send contact email:', result.error);
      // Even if email fails, we return success to the user:
      // the lead is already persisted in contact_requests.
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
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #172554 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
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
