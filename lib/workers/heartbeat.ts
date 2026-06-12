import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Heartbeat del processo worker.
 *
 * Il worker gira in un container separato dal processo Next: l'unico canale
 * condiviso è Redis. Ogni `intervalMs` scriviamo un timestamp con TTL:
 * se il worker muore, la chiave scade da sola e /api/health/workers
 * può segnalare il problema senza falsi positivi da chiavi stantie.
 */

export const HEARTBEAT_KEY = 'worker:heartbeat';
// TTL = 3 battiti mancati con l'intervallo di default (30s): margine per
// riavvii/deploy senza allarmi spuri.
export const HEARTBEAT_TTL_SECONDS = 90;

/**
 * Avvia il battito periodico. Scrive subito il primo battito, poi uno ogni
 * intervallo. Ritorna la funzione di stop (da chiamare nello shutdown).
 */
export function startHeartbeat(intervalMs = 30_000): () => void {
  const beat = () => {
    // redis.set (wrapper lib/redis) non lancia mai: logga e ritorna false.
    // Il catch difende comunque da mock/implementazioni future che rigettano.
    void Promise.resolve(redis.set(HEARTBEAT_KEY, String(Date.now()), HEARTBEAT_TTL_SECONDS)).catch(
      (err) => logger.warn('Heartbeat: scrittura su Redis fallita', err)
    );
  };

  beat(); // primo battito immediato: il deploy può verificarlo subito
  const timer = setInterval(beat, intervalMs);
  // In Node non teniamo vivo l'event loop solo per l'heartbeat
  if (typeof (timer as any).unref === 'function') (timer as any).unref();

  return () => clearInterval(timer);
}
