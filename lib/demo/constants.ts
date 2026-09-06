/**
 * Credenziali del tenant demo PUBBLICO. La password è deliberatamente
 * pubblica (decisione di prodotto): il tenant demo è isolato, read-mostly
 * e viene resettato ogni notte dal cron reset-demo-tenant. Le env
 * DEMO_PASSWORD / NEXT_PUBLIC_DEMO_PASSWORD possono comunque sovrascriverla.
 *
 * Modulo client-safe: NIENTE import di prisma o codice server.
 */
export const DEMO_EMAIL = 'demo@insegnami.pro';
export const DEFAULT_DEMO_PASSWORD = 'demo1234';
