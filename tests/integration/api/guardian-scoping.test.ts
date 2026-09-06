/**
 * Guardian scoping (Wave 2): un genitore collegato ai figli via StudentGuardian
 * (tabella ponte multi-figlio/multi-tutore) deve vedere SOLO i dati dei propri
 * figli su payments/grades/report-cards/disciplinary-notes; un PARENT estraneo
 * (nessun link guardian né parentUserId) non vede nulla (array vuoto).
 *
 * Pattern mock del repo: proxy Prisma (@/lib/db), getAuth (@/lib/auth),
 * tenant-access ok:true.
 */

// ---- mock infrastruttura (i factory possono referenziare solo variabili `mock*`) ----

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

const { getAuth } = require('@/lib/auth');

export {}; // modulo TS: evita collisioni di scope con altri test

// ---- helper ----

function parentSession(userId: string) {
  return {
    user: {
      id: userId,
      tenantId: 'tenant-1',
      role: 'PARENT',
      email: `${userId}@test.local`,
      name: 'Parent Test',
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

// Il filtro relazionale atteso sui where con student diretto
const guardianOrFilter = (userId: string) =>
  expect.arrayContaining([
    { parentUserId: userId },
    { guardians: { some: { userId } } },
  ]);

describe('Guardian scoping — genitore con due figli via StudentGuardian', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    const { getTenantAccessCached } = require('@/lib/tenant-access');
    getTenantAccessCached.mockResolvedValue({ ok: true });
    getAuth.mockResolvedValue(parentSession('user-parent'));
    // Due figli collegati via guardian (child-2 SOLO via guardian, non
    // parentUserId: è il caso che il vecchio filtro perdeva)
    prismaFn('studentGuardian', 'findMany').mockResolvedValue([
      { studentId: 'child-1', userId: 'user-parent' },
      { studentId: 'child-2', userId: 'user-parent' },
    ]);
  });

  it('GET /api/payments filtra i pagamenti sui figli (OR guardian + parentUserId)', async () => {
    const { GET } = require('@/app/api/payments/route');
    const res = await GET(makeRequest('/api/payments?page=1&limit=10'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('payment', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.student?.OR).toEqual(guardianOrFilter('user-parent'));
    expect(call?.where?.tenantId).toBe('tenant-1');
  });

  it('GET /api/grades filtra i voti sui figli e solo quelli visibili', async () => {
    const { GET } = require('@/app/api/grades/route');
    const res = await GET(makeRequest('/api/grades?limit=100'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('grade', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.student?.OR).toEqual(guardianOrFilter('user-parent'));
    expect(call?.where?.isVisible).toBe(true);
  });

  it('GET /api/report-cards limita alle pagelle PUBLISHED dei due figli', async () => {
    prismaFn('student', 'findMany').mockResolvedValue([
      { id: 'child-1' },
      { id: 'child-2' },
    ]);

    const { GET } = require('@/app/api/report-cards/route');
    const res = await GET(makeRequest('/api/report-cards?page=1&limit=20'));
    expect([401, 402, 403]).not.toContain(res.status);

    // La risoluzione dei figli è guardian-aware
    const childrenLookup = prismaFn('student', 'findMany').mock.calls.at(-1)?.[0];
    expect(JSON.stringify(childrenLookup?.where)).toContain('guardians');
    expect(JSON.stringify(childrenLookup?.where)).toContain('user-parent');

    const call = prismaFn('reportCard', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.studentId).toEqual({ in: ['child-1', 'child-2'] });
    expect(call?.where?.status).toBe('PUBLISHED');
  });

  it('GET /api/disciplinary-notes limita le note ai due figli', async () => {
    prismaFn('student', 'findMany').mockResolvedValue([
      { id: 'child-1' },
      { id: 'child-2' },
    ]);

    const { GET } = require('@/app/api/disciplinary-notes/route');
    const res = await GET(makeRequest('/api/disciplinary-notes'));
    expect([401, 402, 403]).not.toContain(res.status);

    const childrenLookup = prismaFn('student', 'findMany').mock.calls.at(-1)?.[0];
    expect(JSON.stringify(childrenLookup?.where)).toContain('guardians');
    expect(JSON.stringify(childrenLookup?.where)).toContain('user-parent');

    const call = prismaFn('disciplinaryNote', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.studentId).toEqual({ in: ['child-1', 'child-2'] });
  });
});

describe('Guardian scoping — PARENT estraneo non vede nulla', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    const { getTenantAccessCached } = require('@/lib/tenant-access');
    getTenantAccessCached.mockResolvedValue({ ok: true });
    // Nessun link guardian né parentUserId: i default del mock restituiscono []
    getAuth.mockResolvedValue(parentSession('user-parent-x'));
  });

  it('GET /api/payments → array vuoto, filtro legato al genitore estraneo', async () => {
    const { GET } = require('@/app/api/payments/route');
    const res = await GET(makeRequest('/api/payments?page=1&limit=10'));
    expect([401, 402, 403]).not.toContain(res.status);

    const body = await res.json();
    expect(body.payments).toEqual([]);

    const call = prismaFn('payment', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.student?.OR).toEqual(guardianOrFilter('user-parent-x'));
  });

  it('GET /api/grades → array vuoto', async () => {
    const { GET } = require('@/app/api/grades/route');
    const res = await GET(makeRequest('/api/grades?limit=100'));
    expect([401, 402, 403]).not.toContain(res.status);

    const body = await res.json();
    expect(body.grades).toEqual([]);

    const call = prismaFn('grade', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.student?.OR).toEqual(guardianOrFilter('user-parent-x'));
  });

  it('GET /api/report-cards → array vuoto (in: [] non matcha nulla)', async () => {
    const { GET } = require('@/app/api/report-cards/route');
    const res = await GET(makeRequest('/api/report-cards?page=1&limit=20'));
    expect([401, 402, 403]).not.toContain(res.status);

    const body = await res.json();
    expect(body.data).toEqual([]);

    const call = prismaFn('reportCard', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.studentId).toEqual({ in: [] });
  });

  it('GET /api/disciplinary-notes → array vuoto', async () => {
    const { GET } = require('@/app/api/disciplinary-notes/route');
    const res = await GET(makeRequest('/api/disciplinary-notes'));
    expect([401, 402, 403]).not.toContain(res.status);

    const body = await res.json();
    expect(body.data).toEqual([]);

    const call = prismaFn('disciplinaryNote', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.studentId).toEqual({ in: [] });
  });
});
