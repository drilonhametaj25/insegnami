import { test, expect } from '@playwright/test';
import { storageStateFor, testApi, SEED_TENANT_SLUG, SECOND_TENANT_SLUG } from './helpers/auth';

/**
 * Isolamento multi-tenant (suite parametrica).
 *
 * Loggati come admin del SECONDO tenant (second-school), tentiamo di accedere
 * alle risorse del tenant PRINCIPALE (english-plus) sia per ID diretto
 * (GET/PUT/PATCH/DELETE sulla route [id]) sia via lista. Ogni accesso
 * cross-tenant deve essere negato (403) o invisibile (404) — MAI 200.
 *
 * Gli ID del tenant principale vengono recuperati dall'endpoint di test
 * (/api/test, azione 'get-cross-tenant-ids', solo non-prod). I moduli senza
 * record seed (id null) o senza route di dettaglio vengono skippati.
 */

// Tutta la suite usa la sessione admin2 salvata dal progetto di setup.
test.use({ storageState: storageStateFor('admin2') });

type ModuleDef = {
  /** Nome del modulo (per i titoli dei test). */
  name: string;
  /** Chiave dell'ID restituito da 'get-cross-tenant-ids' per la route [id]. */
  key: string;
  /** Endpoint lista del modulo. */
  list: string;
  /** Endpoint di dettaglio; assente per i moduli senza route [id]. */
  detail?: (id: string) => string;
  /** Metodo di aggiornamento esposto dalla route [id] (PUT o PATCH). */
  updateMethod?: 'PUT' | 'PATCH';
  /** Body innocuo per il tentativo di update cross-tenant. */
  updateBody?: Record<string, unknown>;
  /** Chiave alternativa per il controllo lista (se la lista espone un'altra risorsa). */
  listKey?: string;
};

const MODULES: ModuleDef[] = [
  {
    name: 'students',
    key: 'students',
    list: '/api/students?page=1&limit=100',
    detail: (id) => `/api/students/${id}`,
    updateMethod: 'PUT',
    updateBody: { firstName: 'CrossTenant' },
  },
  {
    name: 'teachers',
    key: 'teachers',
    list: '/api/teachers?page=1&limit=100',
    detail: (id) => `/api/teachers/${id}`,
    updateMethod: 'PUT',
    updateBody: { firstName: 'CrossTenant' },
  },
  {
    name: 'classes',
    key: 'classes',
    list: '/api/classes?page=1&limit=100',
    detail: (id) => `/api/classes/${id}`,
    updateMethod: 'PUT',
    updateBody: { name: 'CrossTenant' },
  },
  {
    name: 'lessons',
    key: 'lessons',
    list: '/api/lessons?page=1&limit=100',
    detail: (id) => `/api/lessons/${id}`,
    updateMethod: 'PUT',
    updateBody: { title: 'CrossTenant' },
  },
  {
    name: 'payments',
    key: 'payments',
    list: '/api/payments?page=1&limit=100',
    detail: (id) => `/api/payments/${id}`,
    updateMethod: 'PUT',
    updateBody: { description: 'CrossTenant' },
  },
  {
    name: 'notices',
    key: 'notices',
    list: '/api/notices?page=1&limit=100',
    detail: (id) => `/api/notices/${id}`,
    updateMethod: 'PUT',
    updateBody: { title: 'CrossTenant' },
  },
  {
    name: 'grades',
    key: 'grades',
    list: '/api/grades?page=1&limit=100',
    detail: (id) => `/api/grades/${id}`,
    updateMethod: 'PUT',
    updateBody: { description: 'CrossTenant' },
  },
  {
    name: 'homework',
    key: 'homework',
    list: '/api/homework?page=1&limit=100',
    detail: (id) => `/api/homework/${id}`,
    updateMethod: 'PUT',
    updateBody: { title: 'CrossTenant' },
  },
  {
    name: 'disciplinary-notes',
    key: 'disciplinaryNotes',
    list: '/api/disciplinary-notes?page=1&limit=100',
    detail: (id) => `/api/disciplinary-notes/${id}`,
    updateMethod: 'PUT',
    updateBody: { title: 'CrossTenant' },
  },
  {
    name: 'parent-meetings',
    key: 'parentMeetings',
    list: '/api/parent-meetings?page=1&limit=100',
    detail: (id) => `/api/parent-meetings/${id}`,
    updateMethod: 'PUT',
    updateBody: { notes: 'CrossTenant' },
  },
  {
    name: 'report-cards',
    key: 'reportCards',
    list: '/api/report-cards?page=1&limit=100',
    detail: (id) => `/api/report-cards/${id}`,
    updateMethod: 'PUT',
    updateBody: { notes: 'CrossTenant' },
  },
  {
    name: 'hours-packages',
    key: 'hoursPackages',
    list: '/api/hours-packages?page=1&limit=100',
    detail: (id) => `/api/hours-packages/${id}`,
    updateMethod: 'PUT',
    updateBody: { name: 'CrossTenant' },
  },
  {
    name: 'courses',
    key: 'courses',
    list: '/api/courses?page=1&limit=100',
    detail: (id) => `/api/courses/${id}`,
    updateMethod: 'PUT',
    updateBody: { name: 'CrossTenant' },
  },
  {
    name: 'subjects',
    key: 'subjects',
    list: '/api/subjects?page=1&limit=100',
    detail: (id) => `/api/subjects/${id}`,
    updateMethod: 'PUT',
    updateBody: { name: 'CrossTenant' },
  },
  {
    name: 'academic-years',
    key: 'academicYears',
    list: '/api/academic-years?page=1&limit=100&all=true',
    detail: (id) => `/api/academic-years/${id}`,
    updateMethod: 'PUT',
    updateBody: { name: '2099/2100' },
  },
  {
    // Nessuna route [id]: si verifica solo che la lista non esponga dati altrui
    name: 'attendance',
    key: 'attendance',
    list: '/api/attendance?page=1&limit=100',
  },
  {
    name: 'messages',
    key: 'messages',
    list: '/api/messages?page=1&limit=100',
    detail: (id) => `/api/messages/${id}`,
    updateMethod: 'PUT',
    updateBody: { title: 'CrossTenant' },
  },
  {
    name: 'invoices',
    key: 'invoices',
    list: '/api/invoices?page=1&limit=100',
    detail: (id) => `/api/invoices/${id}`,
    updateMethod: 'PATCH',
    updateBody: { notes: 'CrossTenant' },
  },
  {
    // La lista espone i periodi paghe; la route [id] il singolo cedolino
    name: 'payroll/periods',
    key: 'payrolls',
    listKey: 'payrollPeriods',
    list: '/api/payroll/periods',
    detail: (id) => `/api/payroll/${id}`,
    updateMethod: 'PATCH',
    updateBody: { notes: 'CrossTenant' },
  },
  {
    // Nessuna route [id]: si verifica solo la lista
    name: 'accounting/movements',
    key: 'accountingMovements',
    list: '/api/accounting/movements?page=1&pageSize=100',
  },
  {
    name: 'users',
    key: 'users',
    list: '/api/users?page=1&limit=100',
    detail: (id) => `/api/users/${id}`,
    updateMethod: 'PUT',
    updateBody: { firstName: 'CrossTenant' },
  },
];

/** Raccoglie ricorsivamente tutti i campi `id` (stringa) presenti nel JSON. */
function collectIds(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) collectIds(item, acc);
    return acc;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'id' && typeof value === 'string') acc.add(value);
      else collectIds(value, acc);
    }
  }
  return acc;
}

// ID delle risorse del tenant PRINCIPALE, popolati una volta sola per worker.
let crossIds: Record<string, string | null> = {};

test.beforeAll(async ({ request }) => {
  // Assicura onboarding completo del secondo tenant (sessione admin2 valida)
  await testApi(request, { action: 'complete-onboarding', slug: SECOND_TENANT_SLUG });
  const res = await testApi(request, { action: 'get-cross-tenant-ids', slug: SEED_TENANT_SLUG });
  crossIds = (res && res.ids) || {};
});

test.describe('Isolamento tenant — admin2 non accede ai dati di english-plus', () => {
  for (const mod of MODULES) {
    test.describe(mod.name, () => {
      test('GET dettaglio cross-tenant → 403/404', async ({ request }) => {
        test.skip(!mod.detail, 'modulo senza route di dettaglio [id]');
        const id = crossIds[mod.key];
        test.skip(!id, `nessun record seed per ${mod.key}`);

        const res = await request.get(mod.detail!(id!));
        expect([403, 404], `status inatteso ${res.status()}: ${await res.text()}`).toContain(
          res.status()
        );
      });

      test('UPDATE cross-tenant → 403/404', async ({ request }) => {
        test.skip(!mod.detail || !mod.updateMethod, 'modulo senza route di dettaglio [id]');
        const id = crossIds[mod.key];
        test.skip(!id, `nessun record seed per ${mod.key}`);

        const url = mod.detail!(id!);
        const opts = { data: mod.updateBody ?? {} };
        const res =
          mod.updateMethod === 'PATCH'
            ? await request.patch(url, opts)
            : await request.put(url, opts);
        expect([403, 404], `status inatteso ${res.status()}: ${await res.text()}`).toContain(
          res.status()
        );
      });

      test('DELETE cross-tenant → 403/404', async ({ request }) => {
        test.skip(!mod.detail, 'modulo senza route di dettaglio [id]');
        const id = crossIds[mod.key];
        test.skip(!id, `nessun record seed per ${mod.key}`);

        const res = await request.delete(mod.detail!(id!));
        expect([403, 404], `status inatteso ${res.status()}: ${await res.text()}`).toContain(
          res.status()
        );
      });

      test('la lista non contiene record del tenant principale', async ({ request }) => {
        const id = crossIds[mod.listKey ?? mod.key];
        test.skip(!id, `nessun record seed per ${mod.listKey ?? mod.key}`);

        const res = await request.get(mod.list);
        if (res.status() === 200) {
          // Nessun id del tenant A deve comparire (nemmeno nei nested)
          const ids = Array.from(collectIds(await res.json()));
          expect(ids, `id cross-tenant trovato in lista ${mod.list}`).not.toContain(id);
        } else {
          // Lista eventualmente vietata del tutto: accettiamo solo dinieghi espliciti
          expect([401, 403, 404]).toContain(res.status());
        }
      });
    });
  }
});
