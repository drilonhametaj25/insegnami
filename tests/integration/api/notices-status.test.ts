/**
 * Avvisi con ciclo di vita (Notice.status):
 * - le bozze sono visibili solo a chi gestisce/crea avvisi (manage/create);
 * - ?search= e ?status= sono effettivi per i gestori;
 * - POST salva status/publishedAt; PUT publish persiste status e publishedAt.
 *
 * Pattern mock del repo: proxy Prisma (@/lib/db), getAuth (@/lib/auth),
 * tenant-access ok:true.
 */

// ---- mock infrastruttura ----

const mockPrismaCalls: Record<string, jest.Mock> = {};

function mockDefaultFor(method: string) {
  switch (method) {
    case 'findMany':
    case 'groupBy':
      return [];
    case 'count':
      return 0;
    case 'aggregate':
      return { _sum: {}, _count: {}, _avg: {}, _min: {}, _max: {} };
    case 'findFirst':
    case 'findUnique':
      return null;
    case 'updateMany':
    case 'deleteMany':
    case 'createMany':
      return { count: 0 };
    default:
      return {};
  }
}

const mockFnMethods = new Map<jest.Mock, string>();

function mockGetModelMethod(model: string, method: string): jest.Mock {
  const key = `${model}.${method}`;
  if (!mockPrismaCalls[key]) {
    mockPrismaCalls[key] = jest.fn().mockImplementation(() =>
      Promise.resolve(mockDefaultFor(method))
    );
    mockFnMethods.set(mockPrismaCalls[key], method);
  }
  return mockPrismaCalls[key];
}

const mockPrisma: any = new Proxy(
  {},
  {
    get(_target, model: string) {
      if (model === '$transaction') {
        return (arg: any) =>
          Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma);
      }
      if (model === '$queryRaw' || model === '$executeRaw' || model === '$queryRawUnsafe') {
        return jest.fn().mockResolvedValue([]);
      }
      if (typeof model !== 'string' || model.startsWith('$') || model === 'then') {
        return undefined;
      }
      return new Proxy(
        {},
        {
          get(_t, method: string) {
            if (typeof method !== 'string' || method === 'then') return undefined;
            return mockGetModelMethod(model, method);
          },
        }
      );
    },
  }
);

jest.mock('@/lib/db', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/auth', () => {
  const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'];
  const getAuth = jest.fn();
  return {
    getAuth,
    auth: getAuth,
    authOptions: {},
    handlers: {},
    signIn: jest.fn(),
    signOut: jest.fn(),
    ADMIN_ROLES,
    isAdminRole: (role: string | undefined) => ADMIN_ROLES.includes(role as string),
    canManage: (role: string | undefined) =>
      [...ADMIN_ROLES, 'TEACHER'].includes(role as string),
  };
});

jest.mock('@/lib/tenant-access', () => ({
  getTenantAccessCached: jest.fn().mockResolvedValue({ ok: true }),
  checkTenantAccess: jest.fn().mockResolvedValue({ ok: true }),
  invalidateTenantAccessCache: jest.fn(),
}));

// La create pubblicata importa il servizio notifiche in modo lazy
jest.mock('@/lib/notification-service', () => ({
  NotificationService: {
    notifyNewAnnouncement: jest.fn().mockResolvedValue(undefined),
  },
}));

const { getAuth } = require('@/lib/auth');

export {};

// ---- helper ----

function sessionFor(role: string, userId = 'user-1') {
  return {
    user: {
      id: userId,
      tenantId: 'tenant-1',
      role,
      email: `${userId}@test.local`,
      name: 'Test User',
    },
  };
}

function makeRequest(url: string, method = 'GET', body?: any) {
  return {
    url: `http://localhost${url}`,
    method,
    headers: new Map(),
    json: async () => body ?? {},
    nextUrl: { searchParams: new URL(`http://localhost${url}`).searchParams },
  } as any;
}

function resetPrisma() {
  for (const fn of Object.values(mockPrismaCalls)) {
    const method = mockFnMethods.get(fn) ?? 'findFirst';
    fn.mockReset();
    fn.mockImplementation(() => Promise.resolve(mockDefaultFor(method)));
  }
}

function prismaFn(model: string, method: string): jest.Mock {
  return mockGetModelMethod(model, method);
}

describe('GET /api/notices — visibilità per ruolo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
  });

  it('ADMIN (manage): nessun filtro audience/publishAt, vede anche le bozze', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'));

    const { GET } = require('@/app/api/notices/route');
    const res = await GET(makeRequest('/api/notices?page=1&limit=10'));
    expect(res.status).toBe(200);

    const where = prismaFn('notice', 'findMany').mock.calls.at(-1)?.[0]?.where;
    expect(where.tenantId).toBe('tenant-1');
    expect(where.status).toBeUndefined();
    expect(where.publishAt).toBeUndefined();
    expect(where.targetRoles).toBeUndefined();
  });

  it('ADMIN: ?status=DRAFT e ?search= sono effettivi', async () => {
    getAuth.mockResolvedValue(sessionFor('ADMIN'));

    const { GET } = require('@/app/api/notices/route');
    const res = await GET(
      makeRequest('/api/notices?status=DRAFT&search=riunione')
    );
    expect(res.status).toBe(200);

    const where = prismaFn('notice', 'findMany').mock.calls.at(-1)?.[0]?.where;
    expect(where.status).toBe('DRAFT');
    expect(where.OR).toEqual([
      { title: { contains: 'riunione', mode: 'insensitive' } },
      { content: { contains: 'riunione', mode: 'insensitive' } },
    ]);
  });

  it('STUDENT: solo PUBLISHED, in finestra e con audience sul ruolo', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT', 'user-student'));

    const { GET } = require('@/app/api/notices/route');
    const res = await GET(makeRequest('/api/notices'));
    expect(res.status).toBe(200);

    const where = prismaFn('notice', 'findMany').mock.calls.at(-1)?.[0]?.where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.publishAt).toEqual({ lte: expect.any(Date) });
    expect(where.targetRoles).toEqual({ has: 'STUDENT' });
    // Un eventuale ?status= dello studente NON deve aggirare il filtro
    const res2 = await GET(makeRequest('/api/notices?status=DRAFT'));
    expect(res2.status).toBe(200);
    const where2 = prismaFn('notice', 'findMany').mock.calls.at(-1)?.[0]?.where;
    expect(where2.status).toBe('PUBLISHED');
  });
});

describe('POST /api/notices — status e publishedAt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    getAuth.mockResolvedValue(sessionFor('ADMIN'));
  });

  it('bozza: status DRAFT e publishedAt null', async () => {
    prismaFn('notice', 'create').mockImplementation((args: any) =>
      Promise.resolve({ id: 'n-1', ...args.data })
    );

    const { POST } = require('@/app/api/notices/route');
    const res = await POST(
      makeRequest('/api/notices', 'POST', {
        title: 'Bozza riunione',
        content: 'Testo',
        status: 'DRAFT',
      })
    );
    expect(res.status).toBe(201);

    const data = prismaFn('notice', 'create').mock.calls.at(-1)?.[0]?.data;
    expect(data.status).toBe('DRAFT');
    expect(data.publishedAt).toBeNull();
  });

  it('default: status PUBLISHED con publishedAt valorizzato', async () => {
    prismaFn('notice', 'create').mockImplementation((args: any) =>
      Promise.resolve({ id: 'n-2', ...args.data })
    );

    const { POST } = require('@/app/api/notices/route');
    const res = await POST(
      makeRequest('/api/notices', 'POST', {
        title: 'Avviso',
        content: 'Testo',
      })
    );
    expect(res.status).toBe(201);

    const data = prismaFn('notice', 'create').mock.calls.at(-1)?.[0]?.data;
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toEqual(expect.any(Date));
  });
});

describe('PUT /api/notices/[id] — publish/archive persistono', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    getAuth.mockResolvedValue(sessionFor('ADMIN'));
  });

  it('publish: aggiorna status PUBLISHED e imposta publishedAt', async () => {
    prismaFn('notice', 'findFirst').mockResolvedValue({
      id: 'n-1',
      tenantId: 'tenant-1',
      status: 'DRAFT',
      publishedAt: null,
    });
    prismaFn('notice', 'update').mockImplementation((args: any) =>
      Promise.resolve({ id: 'n-1', ...args.data })
    );

    const { PUT } = require('@/app/api/notices/[id]/route');
    const res = await PUT(
      makeRequest('/api/notices/n-1', 'PUT', { status: 'PUBLISHED' }),
      { params: Promise.resolve({ id: 'n-1' }) }
    );
    expect(res.status).toBe(200);

    const call = prismaFn('notice', 'update').mock.calls.at(-1)?.[0];
    expect(call.where).toEqual({ id: 'n-1' });
    expect(call.data.status).toBe('PUBLISHED');
    expect(call.data.publishedAt).toEqual(expect.any(Date));
  });

  it('archive: aggiorna status ARCHIVED (hook useArchiveNotice)', async () => {
    prismaFn('notice', 'findFirst').mockResolvedValue({
      id: 'n-2',
      tenantId: 'tenant-1',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-01-01'),
    });
    prismaFn('notice', 'update').mockImplementation((args: any) =>
      Promise.resolve({ id: 'n-2', ...args.data })
    );

    const { PUT } = require('@/app/api/notices/[id]/route');
    const res = await PUT(
      makeRequest('/api/notices/n-2', 'PUT', { status: 'ARCHIVED' }),
      { params: Promise.resolve({ id: 'n-2' }) }
    );
    expect(res.status).toBe(200);

    const call = prismaFn('notice', 'update').mock.calls.at(-1)?.[0];
    expect(call.data.status).toBe('ARCHIVED');
    // publishedAt esistente non viene toccato
    expect(call.data.publishedAt).toBeUndefined();
  });
});
