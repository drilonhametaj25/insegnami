import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { getTenantAccessCached, type TenantAccessVerdict } from '@/lib/tenant-access';

/**
 * Enforcement per-request dello stato commerciale del tenant sulle route dati.
 *
 * Le route chiamano blockIfTenantInaccessible(session) subito dopo il check
 * di autenticazione: trial scaduto / PAST_DUE / CANCELLED → 402 con `code`
 * (la UI redirige a /dashboard/billing), tenant disattivato → 403.
 *
 * Decisioni:
 * - Il LOGIN non viene bloccato: l'admin di un tenant bloccato deve poter
 *   entrare per pagare. Con l'enforcement per-request (cache 60s) la durata
 *   del JWT (30 giorni) non è più una finestra di accesso.
 * - Route ESENTI per costruzione (non chiamano il guard): api/auth/*,
 *   api/subscriptions/* (serve per pagare), api/webhooks/*, api/health,
 *   api/contact, api/test, api/superadmin/*, api/onboarding, GDPR export/erase.
 * - SUPERADMIN bypassa sempre.
 */

const BLOCK_MESSAGES: Record<Exclude<TenantAccessVerdict, { ok: true }>['reason'], string> = {
  'tenant-not-found': 'Scuola non trovata',
  'tenant-inactive': 'Questa scuola è stata disattivata. Contatta il supporto.',
  'trial-expired':
    'Il periodo di prova è terminato. Scegli un piano per continuare a usare InsegnaMi.',
  'subscription-past-due':
    'Ultimo pagamento non riuscito. Aggiorna il metodo di pagamento per riattivare il servizio.',
  'subscription-cancelled':
    "L'abbonamento non è attivo. Riattivalo o scegli un piano per continuare.",
};

export function tenantBlockedResponse(
  verdict: Exclude<TenantAccessVerdict, { ok: true }>
): NextResponse {
  const billingBlock =
    verdict.reason === 'trial-expired' ||
    verdict.reason === 'subscription-past-due' ||
    verdict.reason === 'subscription-cancelled';

  return NextResponse.json(
    { error: BLOCK_MESSAGES[verdict.reason], code: verdict.reason },
    { status: billingBlock ? 402 : 403 }
  );
}

/**
 * Ritorna la risposta di blocco (402/403) se il tenant della sessione non può
 * operare, altrimenti null. Da chiamare DOPO il check di autenticazione.
 */
export async function blockIfTenantInaccessible(
  session: Session | null
): Promise<NextResponse | null> {
  const user = session?.user;
  if (!user?.tenantId) return null; // il check auth a monte ha già risposto 401
  if (user.role === 'SUPERADMIN') return null;

  const verdict = await getTenantAccessCached(user.tenantId);
  if (verdict.ok) return null;
  return tenantBlockedResponse(verdict);
}
