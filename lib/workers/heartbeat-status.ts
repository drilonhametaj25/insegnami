import { redis } from '@/lib/redis';
import { HEARTBEAT_KEY, HEARTBEAT_TTL_SECONDS } from '@/lib/workers/heartbeat';

export interface WorkerHeartbeatStatus {
  lastBeat: string | null;
  freshSeconds: number | null;
  healthy: boolean;
}

/**
 * Legge lo stato dell'heartbeat del container worker da Redis.
 * La chiave ha TTL: un worker morto da più di HEARTBEAT_TTL_SECONDS risulta
 * lastBeat null. Non lancia mai: in caso di problemi ritorna "non sano".
 */
export async function readWorkerHeartbeat(): Promise<WorkerHeartbeatStatus> {
  try {
    const raw = await redis.get(HEARTBEAT_KEY);
    const lastBeatMs = raw ? Number(raw) : null;
    const valid = lastBeatMs !== null && Number.isFinite(lastBeatMs);
    const freshSeconds = valid ? Math.round((Date.now() - (lastBeatMs as number)) / 1000) : null;
    return {
      lastBeat: valid ? new Date(lastBeatMs as number).toISOString() : null,
      freshSeconds,
      healthy: freshSeconds !== null && freshSeconds <= HEARTBEAT_TTL_SECONDS,
    };
  } catch {
    return { lastBeat: null, freshSeconds: null, healthy: false };
  }
}
