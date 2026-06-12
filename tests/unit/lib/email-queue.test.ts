/**
 * Split email worker (B2.1): lib/email-queue non deve più istanziare
 * Worker/QueueEvents al caricamento del modulo (le route Next lo importano
 * per il solo producer). Il consumo avviene SOLO via createEmailWorker(),
 * invocata dal processo worker dedicato (scripts/start-workers.ts).
 */

// Rende il file un modulo TS: evita collisioni di scope globale tra test
export {};

const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockQueueClose = jest.fn().mockResolvedValue(undefined);
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
const mockTransporterClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    clean: jest.fn().mockResolvedValue([]),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/redis', () => ({
  redis: { getConnectionConfig: jest.fn(() => ({ host: 'localhost', port: 6379 })) },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    close: mockTransporterClose,
  })),
}));

describe('lib/email-queue', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("l'import del modulo NON istanzia Worker né QueueEvents né Queue", () => {
    jest.isolateModules(() => {
      require('@/lib/email-queue');
    });
    const { Worker, QueueEvents, Queue } = require('bullmq');
    expect(Worker).not.toHaveBeenCalled();
    expect(QueueEvents).not.toHaveBeenCalled();
    expect(Queue).not.toHaveBeenCalled();
  });

  it('createEmailWorker() istanzia il Worker sulla coda email con connection e concurrency', () => {
    const mod = require('@/lib/email-queue');
    const worker = mod.createEmailWorker();
    const { Worker } = require('bullmq');

    expect(worker).toBeDefined();
    expect(Worker).toHaveBeenCalledTimes(1);
    const [queueName, processor, opts] = Worker.mock.calls[0];
    expect(queueName).toBe('email');
    expect(typeof processor).toBe('function');
    expect(opts).toMatchObject({
      connection: { host: 'localhost', port: 6379 },
      concurrency: expect.any(Number),
    });
  });

  it('createEmailWorker() è idempotente (singleton)', () => {
    const mod = require('@/lib/email-queue');
    const a = mod.createEmailWorker();
    const b = mod.createEmailWorker();
    const { Worker } = require('bullmq');
    expect(a).toBe(b);
    expect(Worker).toHaveBeenCalledTimes(1);
  });

  it('sendGenericEmail accoda con queue.add senza creare Worker', async () => {
    const { EmailNotificationService } = require('@/lib/email-queue');
    await EmailNotificationService.sendGenericEmail({
      to: 'a@b.it',
      subject: 'Oggetto',
      html: '<p>ciao</p>',
    });

    const { Queue, Worker } = require('bullmq');
    expect(Queue).toHaveBeenCalledTimes(1); // producer lazy: creato alla prima add
    expect(Worker).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'generic',
      expect.objectContaining({ to: 'a@b.it', subject: 'Oggetto' })
    );
  });

  it('il processor riusa UN solo transporter (pool) per N job', async () => {
    const mod = require('@/lib/email-queue');
    mod.createEmailWorker();
    const { Worker } = require('bullmq');
    const processor = Worker.mock.calls[0][1];

    for (let i = 0; i < 5; i++) {
      await processor({
        id: `job-${i}`,
        name: 'generic',
        data: { to: 'a@b.it', subject: `s${i}`, html: '<p>x</p>' },
      });
    }

    const nodemailer = require('nodemailer');
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ pool: true, maxConnections: 3, maxMessages: 100 })
    );
    expect(mockSendMail).toHaveBeenCalledTimes(5);
  });

  it('shutdownEmailQueue non chiude nulla se il worker non è mai stato creato', async () => {
    const mod = require('@/lib/email-queue');
    await expect(mod.shutdownEmailQueue()).resolves.not.toThrow();
    const { Worker } = require('bullmq');
    expect(Worker).not.toHaveBeenCalled();
    expect(mockTransporterClose).not.toHaveBeenCalled();
  });

  it('shutdownEmailQueue chiude worker e transporter quando creati', async () => {
    const mod = require('@/lib/email-queue');
    const worker = mod.createEmailWorker();
    await mod.shutdownEmailQueue();
    expect(worker.close).toHaveBeenCalled();
    expect(mockTransporterClose).toHaveBeenCalled();
  });
});
