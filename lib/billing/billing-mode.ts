/**
 * Determina se il billing reale Stripe è abilitato.
 *
 * In assenza di chiavi Stripe valide (o con placeholder), l'applicazione
 * usa il "dev billing mode": un'implementazione interna che simula
 * checkout / abbonamenti / upgrade-downgrade / add-on direttamente sul
 * database, così l'intero flusso commerciale è funzionante e testabile
 * end-to-end senza dipendere da Stripe esterno.
 *
 * Quando vengono fornite chiavi sk_test_* / sk_live_* reali (e price IDs
 * non placeholder), lo stesso codice passa automaticamente a Stripe.
 */
export function isStripeEnabled(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  if (!key.startsWith('sk_')) return false;
  if (key.includes('placeholder') || key.includes('your_stripe')) return false;
  return true;
}

/** true quando si usa la simulazione interna invece di Stripe. */
export function isDevBilling(): boolean {
  return !isStripeEnabled();
}

export const TRIAL_DAYS = 14;
