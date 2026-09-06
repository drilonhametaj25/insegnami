/**
 * Import CSV studenti (POST /api/students/bulk action='import', feature
 * 'bulkImport'): 3 righe di cui 1 invalida → 2 create + report errori per
 * riga; feature gate 403 per piano starter.
 *
 * Pattern mock del repo: proxy Prisma (@/lib/db), getAuth (@/lib/auth),
 * tenant-access ok:true, redis no-op, bcrypt e checkStudentLimit mockati.
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

jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getJSON: jest.fn().mockResolvedValue(null),
    setJSON: jest.fn().mockResolvedValue(true),
  },
}));

// bcrypt reale è lento (10 round per riga): mock deterministico
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Limiti piano: il check è già coperto da unit test dedicati altrove
jest.mock('@/lib/plan-limits', () => ({
  checkStudentLimit: jest.fn().mockResolvedValue({
    allowed: true,
    limit: null,
    current: 0,
    remaining: null,
  }),
}));

// Limiti effettivi usati dal ramo 'activate' (anti-bypass): illimitati qui
jest.mock('@/lib/billing/limits', () => ({
  getEffectiveLimits: jest.fn().mockResolvedValue({
    maxStudents: null,
    maxTeachers: null,
    maxClasses: null,
  }),
}));

const { getAuth } = require('@/lib/auth');

export {};

// ---- helper ----

function sessionFor(role: string, userId = 'user-admin') {
  return {
    user: {
      id: userId,
      tenantId: 'tenant-1',
      role,
      email: `${userId}@test.local`,
      name: 'Test Admin',
    },
  };
}

function makeRequest(url: string, method = 'POST', body?: any) {
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

function mockTenantPlan(plan: string) {
  prismaFn('tenant', 'findUnique').mockResolvedValue({
    plan,
    featureFlags: null,
    subscription: null,
  });
}

describe('POST /api/students/bulk action=import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    mockTenantPlan('professional'); // include bulkImport
    getAuth.mockResolvedValue(sessionFor('ADMIN'));
    let userSeq = 0;
    prismaFn('user', 'create').mockImplementation((args: any) =>
      Promise.resolve({ id: `user-${++userSeq}`, ...args.data })
    );
    let studentSeq = 0;
    prismaFn('student', 'create').mockImplementation((args: any) =>
      Promise.resolve({ id: `student-${++studentSeq}`, ...args.data })
    );
  });

  it('3 righe di cui 1 invalida → 2 create + errore per riga', async () => {
    const { POST } = require('@/app/api/students/bulk/route');
    const res = await POST(
      makeRequest('/api/students/bulk', 'POST', {
        action: 'import',
        rows: [
          { firstName: 'Mario', lastName: 'Rossi', email: 'mario@test.local' },
          { firstName: 'Anna' }, // manca il cognome → invalida
          { firstName: 'Luca', lastName: 'Bianchi', dateOfBirth: '2010-05-01' },
        ],
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.created).toBe(2);
    expect(body.meta.total).toBe(3);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].row).toBe(2);
    expect(body.data.errors[0].error).toContain('lastName');

    // 2 studenti creati con codice per-tenant e User "ombra" collegato
    expect(prismaFn('student', 'create')).toHaveBeenCalledTimes(2);
    expect(prismaFn('user', 'create')).toHaveBeenCalledTimes(2);
    expect(prismaFn('userTenant', 'create')).toHaveBeenCalledTimes(2);

    const firstStudent = prismaFn('student', 'create').mock.calls[0]?.[0]?.data;
    expect(firstStudent.tenantId).toBe('tenant-1');
    expect(firstStudent.firstName).toBe('Mario');
    expect(firstStudent.studentCode).toMatch(/^S/);

    const secondStudent = prismaFn('student', 'create').mock.calls[1]?.[0]?.data;
    expect(secondStudent.dateOfBirth).toEqual(new Date('2010-05-01'));
  });

  it('email già esistente → errore per quella riga, le altre passano', async () => {
    prismaFn('user', 'findUnique').mockImplementation((args: any) =>
      Promise.resolve(
        args?.where?.email === 'occupata@test.local' ? { id: 'user-existing' } : null
      )
    );

    const { POST } = require('@/app/api/students/bulk/route');
    const res = await POST(
      makeRequest('/api/students/bulk', 'POST', {
        action: 'import',
        rows: [
          { firstName: 'Mario', lastName: 'Rossi', email: 'occupata@test.local' },
          { firstName: 'Luca', lastName: 'Bianchi' },
        ],
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.created).toBe(1);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].row).toBe(1);
    expect(body.data.errors[0].error).toContain('Email già utilizzata');
  });

  it('feature gate: piano starter → 403 feature-not-in-plan', async () => {
    mockTenantPlan('starter');

    const { POST } = require('@/app/api/students/bulk/route');
    const res = await POST(
      makeRequest('/api/students/bulk', 'POST', {
        action: 'import',
        rows: [{ firstName: 'Mario', lastName: 'Rossi' }],
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('feature-not-in-plan');
    expect(prismaFn('student', 'create')).not.toHaveBeenCalled();
  });

  it('le azioni bulk esistenti restano invariate (activate)', async () => {
    prismaFn('student', 'findMany').mockResolvedValue([
      { id: 's-1', status: 'INACTIVE' },
    ]);
    prismaFn('student', 'updateMany').mockResolvedValue({ count: 1 });

    const { POST } = require('@/app/api/students/bulk/route');
    const res = await POST(
      makeRequest('/api/students/bulk', 'POST', {
        action: 'activate',
        studentIds: ['s-1'],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
  });
});
