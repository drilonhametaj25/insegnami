/**
 * Test per lib/queue/health.ts (B2.3)
 * Verifica che getAllQueueHealth() esponga esattamente le 3 code attive
 * (email, automation, cron) dopo la rimozione delle code morte pdf/notification.
 */

// I mock devono usare il prefisso "mock" per essere referenziabili nella factory di jest.mock
const mockGetJobCounts = jest.fn();
const mockClose = jest.fn();
const mockQueueCtor = jest.fn().mockImplementation(() => ({
  getJobCounts: mockGetJobCounts,
  close: mockClose,
}));

jest.mock('bullmq', () => ({
  // Wrapper lazy: la factory viene hoistata sopra le const, quindi il
  // riferimento a mockQueueCtor deve essere risolto solo a tempo di chiamata
  Queue: function (...args: unknown[]) {
    return mockQueueCtor(...args);
  },
}));

// Mock del manager Redis: nessuna connessione reale nei test
jest.mock('@/lib/redis', () => ({
  redis: {
    getConnectionConfig: jest.fn(() => ({ host: 'localhost', port: 6379 })),
    getClient: jest.fn(() => null),
  },
}));

import { getAllQueueHealth } from '@/lib/queue/health';

const EXPECTED_QUEUES = ['email', 'automation', 'cron'];

describe('getAllQueueHealth', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Backup dell'environment: ogni test manipola REDIS_URL
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore completo dell'environment
    process.env = originalEnv;
  });

  it('ritorna esattamente le 3 code attive: email, automation, cron', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    mockGetJobCounts.mockResolvedValue({
      waiting: 1,
      active: 2,
      delayed: 0,
      completed: 10,
      failed: 3,
    });
    mockClose.mockResolvedValue(undefined);

    const results = await getAllQueueHealth();

    expect(results.map((r) => r.name)).toEqual(EXPECTED_QUEUES);
    expect(results).toHaveLength(3);
  });

  it('con REDIS_URL configurato espone i contatori per ogni coda', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    mockGetJobCounts.mockResolvedValue({
      waiting: 1,
      active: 2,
      delayed: 0,
      completed: 10,
      failed: 3,
    });
    mockClose.mockResolvedValue(undefined);

    const results = await getAllQueueHealth();

    for (const result of results) {
      expect(result.available).toBe(true);
      expect(result.counts).toEqual({
        waiting: 1,
        active: 2,
        delayed: 0,
        completed: 10,
        failed: 3,
      });
    }
    // Una Queue effimera per ogni coda, tutte chiuse a fine check
    expect(mockQueueCtor).toHaveBeenCalledTimes(3);
    expect(mockClose).toHaveBeenCalledTimes(3);
  });

  it('senza REDIS_URL ritorna available:false per tutte le code senza toccare bullmq', async () => {
    delete process.env.REDIS_URL;

    const results = await getAllQueueHealth();

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.available).toBe(false);
      expect(result.error).toBe('REDIS_URL not configured');
      expect(result.counts).toBeUndefined();
    }
    // Nessuna Queue costruita: il check corto-circuita prima
    expect(mockQueueCtor).not.toHaveBeenCalled();
  });

  it('se getJobCounts fallisce la coda risulta available:false con il messaggio di errore', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    mockGetJobCounts.mockRejectedValue(new Error('connessione rifiutata'));

    const results = await getAllQueueHealth();

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.available).toBe(false);
      expect(result.error).toBe('connessione rifiutata');
    }
  });
});
