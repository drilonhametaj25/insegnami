/**
 * Giustificazione assenze (feature 'absenceJustifications'):
 * - POST dal genitore per un figlio → PENDING;
 * - PATCH approve → Attendance ABSENT del range → EXCUSED;
 * - feature gate: piano starter (senza feature) → 403 'feature-not-in-plan'
 *   (hasFeature risolto dal tenant mockato via prisma).
 *
 * Pattern mock del repo: proxy Prisma (@/lib/db), getAuth (@/lib/auth),
 * tenant-access ok:true, redis no-op (la cache feature non trova nulla).
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

// Redis no-op: la cache delle feature non trova nulla → si passa sempre da
// computeEffectiveFeatures (tenant mockato via prisma)
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getJSON: jest.fn().mockResolvedValue(null),
    setJSON: jest.fn().mockResolvedValue(true),
  },
}));

const { getAuth } = require('@/lib/auth');

export {};

// ---- helper ----

function sessionFor(role: string, userId: string) {
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

// Tenant con piano che include la feature (fallback catalogo su tenant.plan)
function mockTenantPlan(plan: string) {
  prismaFn('tenant', 'findUnique').mockResolvedValue({
    plan,
    featureFlags: null,
    subscription: null,
  });
}

describe('POST /api/absence-justifications — genitore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    mockTenantPlan('professional');
    getAuth.mockResolvedValue(sessionFor('PARENT', 'user-parent'));
    prismaFn('studentGuardian', 'findMany').mockResolvedValue([
      { studentId: 'child-1', userId: 'user-parent' },
    ]);
  });

  it('crea la richiesta PENDING per il figlio collegato', async () => {
    prismaFn('absenceJustification', 'create').mockImplementation((args: any) =>
      Promise.resolve({ id: 'j-1', ...args.data })
    );

    const { POST } = require('@/app/api/absence-justifications/route');
    const res = await POST(
      makeRequest('/api/absence-justifications', 'POST', {
        dateFrom: '2026-02-02T00:00:00.000Z',
        dateTo: '2026-02-04T00:00:00.000Z',
        reason: 'Influenza',
      })
    );
    expect(res.status).toBe(201);

    const data = prismaFn('absenceJustification', 'create').mock.calls.at(-1)?.[0]?.data;
    expect(data.tenantId).toBe('tenant-1');
    expect(data.studentId).toBe('child-1'); // figlio unico implicito
    expect(data.status).toBe('PENDING');
    expect(data.requestedById).toBe('user-parent');
    expect(data.reason).toBe('Influenza');

    const body = await res.json();
    expect(body.data.id).toBe('j-1');
  });

  it('rifiuta uno studentId che non è un proprio figlio', async () => {
    const { POST } = require('@/app/api/absence-justifications/route');
    const res = await POST(
      makeRequest('/api/absence-justifications', 'POST', {
        studentId: 'child-di-altri',
        dateFrom: '2026-02-02T00:00:00.000Z',
        dateTo: '2026-02-04T00:00:00.000Z',
        reason: 'Influenza',
      })
    );
    expect(res.status).toBe(400);
    expect(prismaFn('absenceJustification', 'create')).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/absence-justifications/[id] — approvazione', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    mockTenantPlan('professional');
    getAuth.mockResolvedValue(sessionFor('ADMIN', 'user-admin'));
    prismaFn('absenceJustification', 'findFirst').mockResolvedValue({
      id: 'j-1',
      tenantId: 'tenant-1',
      studentId: 'child-1',
      dateFrom: new Date('2026-02-02T00:00:00.000Z'),
      dateTo: new Date('2026-02-04T00:00:00.000Z'),
      status: 'PENDING',
    });
    prismaFn('absenceJustification', 'update').mockImplementation((args: any) =>
      Promise.resolve({ id: 'j-1', ...args.data })
    );
  });

  it('approve → giustificazione APPROVED e Attendance ABSENT del range → EXCUSED', async () => {
    const { PATCH } = require('@/app/api/absence-justifications/[id]/route');
    const res = await PATCH(
      makeRequest('/api/absence-justifications/j-1', 'PATCH', { action: 'approve' }),
      { params: Promise.resolve({ id: 'j-1' }) }
    );
    expect(res.status).toBe(200);

    const update = prismaFn('absenceJustification', 'update').mock.calls.at(-1)?.[0];
    expect(update.data.status).toBe('APPROVED');
    expect(update.data.decidedById).toBe('user-admin');
    expect(update.data.decidedAt).toEqual(expect.any(Date));

    const attendanceCall = prismaFn('attendance', 'updateMany').mock.calls.at(-1)?.[0];
    expect(attendanceCall.where.studentId).toBe('child-1');
    expect(attendanceCall.where.status).toBe('ABSENT');
    expect(attendanceCall.where.lesson.tenantId).toBe('tenant-1');
    expect(attendanceCall.where.lesson.startTime.gte).toEqual(expect.any(Date));
    expect(attendanceCall.where.lesson.startTime.lte).toEqual(expect.any(Date));
    expect(attendanceCall.data).toEqual({ status: 'EXCUSED' });
  });

  it('reject → REJECTED e nessuna riscrittura delle Attendance', async () => {
    const { PATCH } = require('@/app/api/absence-justifications/[id]/route');
    const res = await PATCH(
      makeRequest('/api/absence-justifications/j-1', 'PATCH', { action: 'reject' }),
      { params: Promise.resolve({ id: 'j-1' }) }
    );
    expect(res.status).toBe(200);

    const update = prismaFn('absenceJustification', 'update').mock.calls.at(-1)?.[0];
    expect(update.data.status).toBe('REJECTED');
    expect(prismaFn('attendance', 'updateMany')).not.toHaveBeenCalled();
  });

  it('PARENT non può decidere (403 dal gate ruoli)', async () => {
    getAuth.mockResolvedValue(sessionFor('PARENT', 'user-parent'));

    const { PATCH } = require('@/app/api/absence-justifications/[id]/route');
    const res = await PATCH(
      makeRequest('/api/absence-justifications/j-1', 'PATCH', { action: 'approve' }),
      { params: Promise.resolve({ id: 'j-1' }) }
    );
    expect(res.status).toBe(403);
    expect(prismaFn('absenceJustification', 'update')).not.toHaveBeenCalled();
  });
});

describe('Feature gate — piano starter senza absenceJustifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    mockTenantPlan('starter'); // il catalogo starter NON include la feature
    getAuth.mockResolvedValue(sessionFor('PARENT', 'user-parent'));
    prismaFn('studentGuardian', 'findMany').mockResolvedValue([
      { studentId: 'child-1', userId: 'user-parent' },
    ]);
  });

  it('POST → 403 con code feature-not-in-plan', async () => {
    const { POST } = require('@/app/api/absence-justifications/route');
    const res = await POST(
      makeRequest('/api/absence-justifications', 'POST', {
        dateFrom: '2026-02-02T00:00:00.000Z',
        dateTo: '2026-02-04T00:00:00.000Z',
        reason: 'Influenza',
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('feature-not-in-plan');
    expect(prismaFn('absenceJustification', 'create')).not.toHaveBeenCalled();
  });

  it('GET → 403 con code feature-not-in-plan', async () => {
    const { GET } = require('@/app/api/absence-justifications/route');
    const res = await GET(makeRequest('/api/absence-justifications'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('feature-not-in-plan');
  });
});
