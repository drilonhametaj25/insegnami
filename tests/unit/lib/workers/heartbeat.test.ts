/**
 * Heartbeat del processo worker (B1.1): scrive periodicamente un timestamp
 * su Redis con TTL, così /api/health/workers può verificare che il
 * container worker sia vivo anche senza accesso diretto al processo.
 */

jest.mock('@/lib/redis', () => ({
  redis: { set: jest.fn().mockResolvedValue(true) },
}));

import {
  startHeartbeat,
  HEARTBEAT_KEY,
  HEARTBEAT_TTL_SECONDS,
} from '@/lib/workers/heartbeat';

const { redis } = require('@/lib/redis');

describe('startHeartbeat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('scrive subito il primo battito con chiave e TTL attesi', () => {
    const stop = startHeartbeat(30_000);
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      HEARTBEAT_KEY,
      expect.any(String),
      HEARTBEAT_TTL_SECONDS
    );
    stop();
  });

  it('il valore scritto è un timestamp in millisecondi', () => {
    const before = Date.now();
    const stop = startHeartbeat(30_000);
    const value = Number(redis.set.mock.calls[0][1]);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(before);
    stop();
  });

  it('scrive un battito a ogni intervallo', () => {
    const stop = startHeartbeat(30_000);
    jest.advanceTimersByTime(90_000);
    // 1 immediato + 3 intervalli
    expect(redis.set).toHaveBeenCalledTimes(4);
    stop();
  });

  it('usa il TTL di 90 secondi su ogni battito', () => {
    const stop = startHeartbeat(30_000);
    jest.advanceTimersByTime(60_000);
    for (const call of redis.set.mock.calls) {
      expect(call[2]).toBe(HEARTBEAT_TTL_SECONDS);
    }
    expect(HEARTBEAT_TTL_SECONDS).toBe(90);
    stop();
  });

  it('stop() ferma i battiti successivi', () => {
    const stop = startHeartbeat(30_000);
    stop();
    jest.advanceTimersByTime(300_000);
    expect(redis.set).toHaveBeenCalledTimes(1); // solo il battito immediato
  });

  it('default: intervallo di 30 secondi', () => {
    const stop = startHeartbeat();
    jest.advanceTimersByTime(29_999);
    expect(redis.set).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(redis.set).toHaveBeenCalledTimes(2);
    stop();
  });

  it('non esplode se redis.set fallisce', () => {
    redis.set.mockRejectedValueOnce(new Error('redis down'));
    const stop = startHeartbeat(30_000);
    expect(() => jest.advanceTimersByTime(30_000)).not.toThrow();
    expect(redis.set).toHaveBeenCalledTimes(2);
    stop();
  });
});
