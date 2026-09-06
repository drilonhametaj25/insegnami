/**
 * Suite RBAC parametrica (Wave 1): codifica il contratto di autorizzazione
 * per ruolo sugli endpoint principali. Ogni riga di CASES dichiara, per i 7
 * ruoli, se la richiesta deve passare il gate di autorizzazione ('allow')
 * o essere respinta con 403 ('deny').
 *
 * Semantica volutamente robusta ai dati mockati:
 *  - 'deny'  → status esattamente 403 (o 401 se non autenticabile)
 *  - 'allow' → status DIVERSO da 401/402/403 (404/400 sono accettati:
 *              dipendono dai dati, non dall'autorizzazione)
 * Gli assert di scoping (where filtrato per docente/studente/genitore) sono
 * nei describe dedicati in fondo, con i lookup risolti esplicitamente.
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

jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getConnectionConfig: jest.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
  },
}));

jest.mock('@/lib/stripe', () => ({
  createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test' }),
  stripe: {},
  isStripeEnabled: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/queue/health', () => ({
  getAllQueueHealth: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/automation-service', () => ({
  AutomationService: {
    runDailyAutomation: jest.fn(),
    setupDailyReminders: jest.fn(),
    setupPaymentReminders: jest.fn(),
    checkClassCapacity: jest.fn(),
  },
  automationQueue: { add: jest.fn(), getJobCounts: jest.fn().mockResolvedValue({}) },
}));

jest.mock('@/lib/workers/cron-scheduler', () => ({
  triggerCronJob: jest.fn().mockResolvedValue(undefined),
  CRON_JOB_NAMES: [],
}));

jest.mock('@/lib/workers/heartbeat', () => ({
  HEARTBEAT_KEY: 'hb',
  HEARTBEAT_TTL_SECONDS: 60,
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

const { getAuth } = require('@/lib/auth');

export {}; // rende il file un modulo TS: evita collisioni di scope con altri test

// ---- helper sessione/richiesta ----

const ROLES = [
  'SUPERADMIN',
  'ADMIN',
  'DIRECTOR',
  'SECRETARY',
  'TEACHER',
  'STUDENT',
  'PARENT',
] as const;
type RoleName = (typeof ROLES)[number];
type Expectation = 'allow' | 'deny';

function sessionFor(role: RoleName) {
  return {
    user: {
      id: `user-${role.toLowerCase()}`,
      tenantId: 'tenant-1',
      role,
      email: `${role.toLowerCase()}@test.local`,
      name: `${role} Test`,
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

// ---- tabella dei casi ----

type RouteCase = {
  name: string;
  load: () => any; // require del modulo route (lazy, dopo i mock)
  handler: 'GET' | 'POST';
  request: () => any;
  params?: () => { params: Promise<Record<string, string>> };
  expectations: Record<RoleName, Expectation>;
  setup?: () => void;
};

const allowAdminOnly: Record<RoleName, Expectation> = {
  SUPERADMIN: 'allow',
  ADMIN: 'allow',
  DIRECTOR: 'allow',
  SECRETARY: 'allow',
  TEACHER: 'deny',
  STUDENT: 'deny',
  PARENT: 'deny',
};

const allowAll: Record<RoleName, Expectation> = {
  SUPERADMIN: 'allow',
  ADMIN: 'allow',
  DIRECTOR: 'allow',
  SECRETARY: 'allow',
  TEACHER: 'allow',
  STUDENT: 'allow',
  PARENT: 'allow',
};

const CASES: RouteCase[] = [
  {
    name: 'GET /api/analytics (overview: dati finanziari della scuola)',
    load: () => require('@/app/api/analytics/route'),
    handler: 'GET',
    request: () => makeRequest('/api/analytics?type=overview&period=30'),
    expectations: allowAdminOnly,
  },
  {
    name: 'GET /api/reports (report amministrativi)',
    load: () => require('@/app/api/reports/route'),
    handler: 'GET',
    request: () => makeRequest('/api/reports'),
    expectations: allowAdminOnly,
  },
  {
    name: 'GET /api/grades/class/[classId]/subject/[subjectId] (griglia voti classe)',
    load: () => require('@/app/api/grades/class/[classId]/subject/[subjectId]/route'),
    handler: 'GET',
    request: () => makeRequest('/api/grades/class/c1/subject/s1'),
    params: () => ({ params: Promise.resolve({ classId: 'c1', subjectId: 's1' }) }),
    // TEACHER senza titolarità risolvibile → deny (il caso titolare è nel describe dedicato)
    expectations: allowAdminOnly,
  },
  {
    name: 'GET /api/classes?all=true&include=students (anagrafica iscritti)',
    load: () => require('@/app/api/classes/route'),
    handler: 'GET',
    request: () => makeRequest('/api/classes?all=true&include=students'),
    // STUDENT e PARENT: allow ma filtrati (describe dedicati)
    expectations: allowAll,
  },
  {
    name: 'GET /api/lessons (registri di presenza nominativi)',
    load: () => require('@/app/api/lessons/route'),
    handler: 'GET',
    request: () => makeRequest('/api/lessons?page=1&limit=10'),
    // Wave 2: PARENT allow ma filtrato sui figli (describe dedicato)
    expectations: allowAll,
  },
  {
    name: 'GET /api/hours-packages (pacchetti ore con prezzi)',
    load: () => require('@/app/api/hours-packages/route'),
    handler: 'GET',
    request: () => makeRequest('/api/hours-packages'),
    expectations: {
      ...allowAll,
      TEACHER: 'deny', // la matrice non concede la risorsa al docente
    },
  },
  {
    name: 'GET /api/grades (senza teacher record risolvibile)',
    load: () => require('@/app/api/grades/route'),
    handler: 'GET',
    request: () => makeRequest('/api/grades?limit=100'),
    expectations: {
      ...allowAll,
      TEACHER: 'deny', // deny-by-default se il profilo Teacher non risolve
    },
  },
  {
    name: 'GET /api/students (anagrafica completa)',
    load: () => require('@/app/api/students/route'),
    handler: 'GET',
    request: () => makeRequest('/api/students?page=1&limit=10'),
    expectations: {
      SUPERADMIN: 'allow',
      ADMIN: 'allow',
      DIRECTOR: 'allow',
      SECRETARY: 'allow',
      TEACHER: 'deny', // senza profilo Teacher → deny; scoping nel dedicato
      STUDENT: 'deny',
      PARENT: 'deny',
    },
  },
  {
    name: 'GET /api/attendance/export (export presenze)',
    load: () => require('@/app/api/attendance/export/route'),
    handler: 'GET',
    request: () => makeRequest('/api/attendance/export?format=csv'),
    expectations: {
      ...allowAdminOnly,
      TEACHER: 'deny', // senza profilo Teacher risolvibile → deny
    },
  },
  {
    name: 'GET /api/attendance/stats (statistiche presenze)',
    load: () => require('@/app/api/attendance/stats/route'),
    handler: 'GET',
    request: () => makeRequest('/api/attendance/stats'),
    expectations: {
      ...allowAdminOnly,
      TEACHER: 'deny',
    },
  },
  {
    name: 'GET /api/homework?classId=c1 (bypass filtro docente)',
    load: () => require('@/app/api/homework/route'),
    handler: 'GET',
    request: () => makeRequest('/api/homework?classId=c1'),
    expectations: {
      ...allowAll,
      TEACHER: 'deny', // senza profilo Teacher → deny (con profilo: filtrato, nel dedicato)
    },
  },
  {
    name: 'POST /api/lessons/recurring (creazione serie lezioni)',
    load: () => require('@/app/api/lessons/recurring/route'),
    handler: 'POST',
    request: () =>
      makeRequest('/api/lessons/recurring', 'POST', {
        title: 'Serie',
        classId: 'c1',
        teacherId: 't1',
        startTime: '2026-10-01T10:00:00Z',
        endTime: '2026-10-01T11:00:00Z',
        recurrence: { frequency: 'weekly', interval: 1, count: 4 },
      }),
    expectations: {
      SUPERADMIN: 'allow',
      ADMIN: 'allow',
      DIRECTOR: 'allow',
      SECRETARY: 'allow',
      TEACHER: 'allow',
      STUDENT: 'deny',
      PARENT: 'deny',
    },
  },
  {
    name: 'GET /api/automation (stato piattaforma)',
    load: () => require('@/app/api/automation/route'),
    handler: 'GET',
    request: () => makeRequest('/api/automation'),
    expectations: {
      SUPERADMIN: 'allow',
      ADMIN: 'deny',
      DIRECTOR: 'deny',
      SECRETARY: 'deny',
      TEACHER: 'deny',
      STUDENT: 'deny',
      PARENT: 'deny',
    },
  },
  {
    name: 'GET /api/health/workers (salute code piattaforma)',
    load: () => require('@/app/api/health/workers/route'),
    handler: 'GET',
    request: () => makeRequest('/api/health/workers'),
    expectations: {
      SUPERADMIN: 'allow',
      ADMIN: 'deny',
      DIRECTOR: 'deny',
      SECRETARY: 'deny',
      TEACHER: 'deny',
      STUDENT: 'deny',
      PARENT: 'deny',
    },
  },
  {
    name: 'GET /api/schedules (lettura orari: concessa a tutti dalla matrice)',
    load: () => require('@/app/api/schedules/route'),
    handler: 'GET',
    request: () => makeRequest('/api/schedules'),
    expectations: allowAll,
  },
  {
    name: 'GET /api/courses/stats (statistiche corsi: lettura concessa)',
    load: () => require('@/app/api/courses/stats/route'),
    handler: 'GET',
    request: () => makeRequest('/api/courses/stats'),
    expectations: allowAll,
  },
  {
    name: 'GET /api/messages/templates (template interni)',
    load: () => require('@/app/api/messages/templates/route'),
    handler: 'GET',
    request: () => makeRequest('/api/messages/templates'),
    expectations: {
      ...allowAdminOnly,
      TEACHER: 'allow',
    },
  },
  {
    name: 'GET /api/payments/stats (fatturato e insoluti)',
    load: () => require('@/app/api/payments/stats/route'),
    handler: 'GET',
    request: () => makeRequest('/api/payments/stats'),
    expectations: allowAdminOnly,
  },
  {
    name: 'GET /api/dashboard/admin/stats',
    load: () => require('@/app/api/dashboard/admin/stats/route'),
    handler: 'GET',
    request: () => makeRequest('/api/dashboard/admin/stats'),
    expectations: allowAdminOnly,
  },
  {
    name: 'GET /api/dashboard/admin/activities',
    load: () => require('@/app/api/dashboard/admin/activities/route'),
    handler: 'GET',
    request: () => makeRequest('/api/dashboard/admin/activities'),
    expectations: allowAdminOnly,
  },
];

// ---- esecuzione parametrica ----

describe('RBAC matrix — contratto di autorizzazione per ruolo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    const { getTenantAccessCached } = require('@/lib/tenant-access');
    getTenantAccessCached.mockResolvedValue({ ok: true });
  });

  for (const routeCase of CASES) {
    describe(routeCase.name, () => {
      for (const role of ROLES) {
        const expected = routeCase.expectations[role];
        it(`${role} → ${expected}`, async () => {
          getAuth.mockResolvedValue(sessionFor(role));
          routeCase.setup?.();

          const mod = routeCase.load();
          const handler = mod[routeCase.handler];
          expect(handler).toBeDefined();

          const res = routeCase.params
            ? await handler(routeCase.request(), routeCase.params!())
            : await handler(routeCase.request());

          if (expected === 'deny') {
            expect(res.status).toBe(403);
          } else {
            expect([401, 402, 403]).not.toContain(res.status);
          }
        });
      }
    });
  }
});

// ---- scoping dedicato: il gate passa ma il where DEVE essere filtrato ----

describe('RBAC scoping — filtri per proprietà', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    const { getTenantAccessCached } = require('@/lib/tenant-access');
    getTenantAccessCached.mockResolvedValue({ ok: true });
  });

  it('TEACHER su GET /api/lessons vede solo le proprie lezioni', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });

    const { GET } = require('@/app/api/lessons/route');
    const res = await GET(makeRequest('/api/lessons?page=1&limit=10'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('lesson', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.teacherId).toBe('teacher-1');
  });

  it('STUDENT su GET /api/classes vede solo le proprie classi e mai gli iscritti', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT'));
    prismaFn('student', 'findFirst').mockResolvedValue({ id: 'student-1' });

    const { GET } = require('@/app/api/classes/route');
    const res = await GET(makeRequest('/api/classes?all=true&include=students'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('class', 'findMany').mock.calls.at(-1)?.[0];
    expect(JSON.stringify(call?.where)).toContain('student-1');
    // l'elenco iscritti non deve essere incluso per un ruolo non admin/docente
    const included = JSON.stringify(call?.include ?? {});
    expect(included).not.toContain('"user"');
  });

  it('TEACHER su GET /api/grades vede solo i voti propri', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });

    const { GET } = require('@/app/api/grades/route');
    const res = await GET(makeRequest('/api/grades?limit=100'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('grade', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.teacherId).toBe('teacher-1');
  });

  it('TEACHER su GET /api/grades?teacherId=altro non può interrogare altri docenti', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });

    const { GET } = require('@/app/api/grades/route');
    const res = await GET(makeRequest('/api/grades?teacherId=teacher-2'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('grade', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.teacherId).toBe('teacher-1');
  });

  it('TEACHER su GET /api/students è limitato alle proprie classi', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });

    const { GET } = require('@/app/api/students/route');
    const res = await GET(makeRequest('/api/students?page=1&limit=10'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('student', 'findMany').mock.calls.at(-1)?.[0];
    expect(JSON.stringify(call?.where)).toContain('teacher-1');
  });

  it('TEACHER su GET /api/attendance/export esporta solo le proprie lezioni', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });

    const { GET } = require('@/app/api/attendance/export/route');
    const res = await GET(makeRequest('/api/attendance/export?format=csv'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('attendance', 'findMany').mock.calls.at(-1)?.[0];
    expect(JSON.stringify(call?.where)).toContain('teacher-1');
  });

  it('TEACHER su GET /api/homework?classId=c1 resta vincolato al proprio teacherId', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });

    const { GET } = require('@/app/api/homework/route');
    const res = await GET(makeRequest('/api/homework?classId=c1'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('homework', 'findMany').mock.calls.at(-1)?.[0];
    expect(call?.where?.teacherId).toBe('teacher-1');
  });

  it('TEACHER titolare della classe può leggere la griglia voti classe/materia', async () => {
    getAuth.mockResolvedValue(sessionFor('TEACHER'));
    prismaFn('teacher', 'findFirst').mockResolvedValue({ id: 'teacher-1' });
    prismaFn('class', 'findFirst').mockResolvedValue({
      id: 'c1',
      tenantId: 'tenant-1',
      teacherId: 'teacher-1',
      name: '1A',
      students: [],
    });
    prismaFn('subject', 'findFirst').mockResolvedValue({
      id: 's1',
      tenantId: 'tenant-1',
      name: 'Matematica',
    });

    const { GET } = require('@/app/api/grades/class/[classId]/subject/[subjectId]/route');
    const res = await GET(makeRequest('/api/grades/class/c1/subject/s1'), {
      params: Promise.resolve({ classId: 'c1', subjectId: 's1' }),
    });
    expect([401, 402, 403]).not.toContain(res.status);
  });

  it('STUDENT su POST /api/payments/checkout non può pagare la rata di un altro studente', async () => {
    getAuth.mockResolvedValue(sessionFor('STUDENT'));
    prismaFn('student', 'findFirst').mockResolvedValue({ id: 'student-1' });
    prismaFn('payment', 'findFirst').mockResolvedValue({
      id: 'p1',
      tenantId: 'tenant-1',
      studentId: 'student-OTHER',
      amount: 100,
      description: 'Rata',
      status: 'PENDING',
    });

    const { POST } = require('@/app/api/payments/checkout/route');
    const res = await POST(
      makeRequest('/api/payments/checkout', 'POST', { paymentId: 'p1' })
    );
    expect([403, 404]).toContain(res.status);
  });

  it('PARENT su GET /api/lessons vede solo le lezioni dei figli', async () => {
    getAuth.mockResolvedValue(sessionFor('PARENT'));
    prismaFn('studentGuardian', 'findMany').mockResolvedValue([
      { studentId: 'child-1' },
    ]);

    const { GET } = require('@/app/api/lessons/route');
    const res = await GET(makeRequest('/api/lessons?page=1&limit=10'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('lesson', 'findMany').mock.calls.at(-1)?.[0];
    // accetta sia il filtro per id figli sia quello relazionale sul tutore
    expect(JSON.stringify(call?.where)).toMatch(/child-1|user-parent/);
  });

  it('PARENT su GET /api/classes vede solo le classi dei figli e mai gli iscritti', async () => {
    getAuth.mockResolvedValue(sessionFor('PARENT'));
    prismaFn('studentGuardian', 'findMany').mockResolvedValue([
      { studentId: 'child-1' },
    ]);

    const { GET } = require('@/app/api/classes/route');
    const res = await GET(makeRequest('/api/classes?all=true&include=students'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('class', 'findMany').mock.calls.at(-1)?.[0];
    expect(JSON.stringify(call?.where)).toMatch(/child-1|user-parent/);
    const included = JSON.stringify(call?.include ?? {});
    expect(included).not.toContain('"user"');
  });

  it('PARENT su GET /api/hours-packages vede solo i pacchetti dei figli', async () => {
    getAuth.mockResolvedValue(sessionFor('PARENT'));

    const { GET } = require('@/app/api/hours-packages/route');
    const res = await GET(makeRequest('/api/hours-packages'));
    expect([401, 402, 403]).not.toContain(res.status);

    const call = prismaFn('hoursPackage', 'findMany').mock.calls.at(-1)?.[0];
    // il filtro deve legare i pacchetti al genitore (parentUserId o guardian)
    expect(JSON.stringify(call?.where)).toContain('user-parent');
  });
});
