/**
 * Strategia queue-first di lib/email (B2.1):
 * - con REDIS_URL configurato sendEmail accoda su BullMQ (il worker dedicato
 *   consuma) senza toccare SMTP;
 * - se la coda non è disponibile fa fallback su invio SMTP diretto;
 * - se né coda né SMTP sono disponibili logga un errore esplicito.
 */

// Rende il file un modulo TS: evita collisioni di scope globale tra test
export {};

// Tutti i mock sono funzioni/oggetti CONDIVISI a livello di modulo (prefisso
// "mock"): le factory possono essere re-invocate da jest in registry isolati,
// ma le asserzioni restano valide perché puntano sempre alle stesse istanze.
const mockSendGenericEmail = jest.fn();
const mockSendMail = jest.fn();
const mockVerify = jest.fn().mockResolvedValue(true);
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify,
}));
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
const mockSmtpConfig = {
  host: 'smtp.test.it',
  port: 465,
  auth: { user: 'utente', pass: 'password' },
};

jest.mock('@/lib/email-queue', () => ({
  EmailNotificationService: { sendGenericEmail: mockSendGenericEmail },
}));

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

jest.mock('@/lib/config', () => ({
  SMTP_CONFIG: mockSmtpConfig,
  EMAIL_FROM: 'noreply@test.it',
}));

const OPTIONS = {
  to: 'dest@test.it',
  subject: 'Oggetto',
  html: '<p>ciao</p>',
};

function loadEmailModule() {
  // ogni test ricarica il modulo per azzerare il transporter lazy
  let mod: any;
  jest.isolateModules(() => {
    mod = require('@/lib/email');
  });
  return mod;
}

describe('lib/email — sendEmail queue-first', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendGenericEmail.mockResolvedValue(undefined);
    mockSendMail.mockResolvedValue({ messageId: 'msg-1', response: 'ok' });
    mockVerify.mockResolvedValue(true);
    mockSmtpConfig.host = 'smtp.test.it';
    mockSmtpConfig.auth.user = 'utente';
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterAll(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  });

  it('con REDIS_URL accoda sulla coda email e non invia via SMTP', async () => {
    const { sendEmail } = loadEmailModule();
    const result = await sendEmail(OPTIONS);

    expect(mockSendGenericEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: OPTIONS.to, subject: OPTIONS.subject })
    );
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, queued: true });
  });

  it("se l'enqueue lancia fa fallback su SMTP diretto", async () => {
    mockSendGenericEmail.mockRejectedValue(new Error('redis down'));
    const { sendEmail } = loadEmailModule();
    const result = await sendEmail(OPTIONS);

    expect(mockSendGenericEmail).toHaveBeenCalled();
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: OPTIONS.to, subject: OPTIONS.subject })
    );
    expect(result).toMatchObject({ success: true, queued: false, messageId: 'msg-1' });
  });

  it('senza REDIS_URL invia direttamente via SMTP senza tentare la coda', async () => {
    delete process.env.REDIS_URL;
    const { sendEmail } = loadEmailModule();
    const result = await sendEmail(OPTIONS);

    expect(mockSendGenericEmail).not.toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, queued: false });
  });

  it('il transporter è lazy: niente createTransport finché non serve SMTP', async () => {
    const { sendEmail } = loadEmailModule();
    await sendEmail(OPTIONS); // va in coda
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('il transporter viene creato una sola volta e verify() viene loggata (non bloccante)', async () => {
    delete process.env.REDIS_URL;
    const { sendEmail } = loadEmailModule();
    await sendEmail(OPTIONS);
    await sendEmail(OPTIONS);
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('se coda e SMTP sono entrambi indisponibili logga errore esplicito', async () => {
    mockSendGenericEmail.mockRejectedValue(new Error('redis down'));
    mockSmtpConfig.host = '';
    mockSmtpConfig.auth.user = '';

    const { sendEmail } = loadEmailModule();
    const result = await sendEmail(OPTIONS);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('senza coda e senza SMTP configurato logga errore esplicito', async () => {
    delete process.env.REDIS_URL;
    mockSmtpConfig.host = '';
    mockSmtpConfig.auth.user = '';

    const { sendEmail } = loadEmailModule();
    const result = await sendEmail(OPTIONS);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });
});
