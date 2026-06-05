import { test, expect } from '@playwright/test';
import { storageStateFor, resetTestData } from './helpers/auth';

/**
 * Verifica end-to-end (livello dati) della creazione nei moduli con flussi
 * UI articolati (date picker / multi-step). Conferma che i backend funzionino
 * con i payload reali, scovando eventuali bug di validazione/relazioni.
 */
test.use({ storageState: storageStateFor('admin') });

test.beforeAll(async ({ request }) => {
  await resetTestData(request);
});

async function ids(page: any) {
  const get = async (u: string) => (await (await page.request.get(u)).json());
  const cls = await get('/api/classes?page=1&limit=5');
  const sub = await get('/api/subjects?page=1&limit=5');
  const tea = await get('/api/teachers?page=1&limit=5');
  const stu = await get('/api/students?page=1&limit=5');
  return {
    classId: (cls.classes || cls.data || [])[0]?.id,
    subjectId: (sub.subjects || sub.data || [])[0]?.id,
    teacherId: (tea.teachers || tea.data || [])[0]?.id,
    studentId: (stu.students || stu.data || [])[0]?.id,
  };
}

test.describe('Moduli — creazione via API', () => {
  // Orario unico e lontano nel futuro, per evitare il rilevamento conflitti
  const uniqueFuture = () =>
    new Date(Date.now() + (60 + Math.floor(Math.random() * 300)) * 86400000 + Math.floor(Math.random() * 8) * 3600000);

  test('Colloquio: creazione riuscita', async ({ page }) => {
    const { teacherId, studentId } = await ids(page);
    const res = await page.request.post('/api/parent-meetings', {
      data: {
        teacherId,
        studentId,
        date: uniqueFuture().toISOString(),
        duration: 30,
        room: 'Aula 1',
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(400);
  });

  test('Voto: creazione riuscita', async ({ page }) => {
    const { classId, subjectId, studentId, teacherId } = await ids(page);
    const res = await page.request.post('/api/grades', {
      data: {
        studentId,
        subjectId,
        classId,
        teacherId,
        value: 8,
        type: 'WRITTEN',
        date: new Date().toISOString(),
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(400);
  });

  test('Messaggio: creazione riuscita', async ({ page }) => {
    const users = await (await page.request.get('/api/users?page=1&limit=5')).json();
    const recipientId = (users.users || users.data || [])[0]?.id;
    expect(recipientId).toBeTruthy();
    const res = await page.request.post('/api/messages', {
      data: {
        title: `Messaggio API ${Date.now()}`,
        content: 'Contenuto di prova',
        type: 'DIRECT',
        recipientIds: [recipientId],
        sendEmail: false,
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(400);
  });

  // Recupera classe con studenti iscritti, il suo docente, e uno studente.
  async function classWithStudent(page: any) {
    const cls = await (await page.request.get('/api/classes?page=1&limit=10')).json();
    const classes = cls.classes || cls.data || [];
    for (const c of classes) {
      const detail = await (await page.request.get(`/api/classes/${c.id}`)).json();
      const students = detail.class?.students || [];
      if (students.length) {
        return { classId: c.id, teacherId: detail.class?.teacher?.id, studentId: students[0].id };
      }
    }
    return {};
  }

  test('Nota disciplinare: creazione riuscita', async ({ page }) => {
    const { classId, teacherId, studentId } = await classWithStudent(page);
    expect(studentId, 'serve una classe seed con studenti').toBeTruthy();
    const res = await page.request.post('/api/disciplinary-notes', {
      data: {
        studentId,
        classId,
        teacherId,
        type: 'NOTE',
        severity: 'MEDIUM',
        title: `Nota Test ${Date.now()}`,
        description: 'Comportamento da segnalare.',
        date: new Date().toISOString(),
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(400);
  });

  test('Pagella: generazione riuscita', async ({ page }) => {
    const { classId, studentId } = await classWithStudent(page);
    expect(studentId).toBeTruthy();
    // Periodo accademico corrente
    const years = await (await page.request.get('/api/academic-years?page=1&limit=10&all=true')).json();
    const list = years.academicYears || years.data || years || [];
    let periodId: string | undefined;
    for (const y of (Array.isArray(list) ? list : [])) {
      const periods = y.periods || [];
      if (periods.length) { periodId = periods[0].id; break; }
    }
    if (!periodId) {
      const periodsRes = await page.request.get('/api/academic-years/current');
      const cur = await periodsRes.json().catch(() => ({}));
      periodId = cur?.periods?.[0]?.id || cur?.academicYear?.periods?.[0]?.id;
    }
    expect(periodId, 'serve un periodo accademico seed').toBeTruthy();

    const res = await page.request.post('/api/report-cards', {
      data: { studentId, classId, periodId },
    });
    const body = await res.text();
    // Esito valido: pagella creata, OPPURE già esistente (anti-duplicato attivo)
    const ok = res.status() < 400 || /già esistente/i.test(body);
    expect(ok, body).toBeTruthy();
  });

  test('Presenze: registrazione massiva riuscita', async ({ page }) => {
    const { classId, teacherId } = await ids(page);
    // Crea una lezione su cui registrare le presenze
    const start = uniqueFuture();
    const lessonRes = await page.request.post('/api/lessons', {
      data: {
        title: `Lezione Test Presenze ${Date.now()}`,
        classId,
        teacherId,
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 3600000).toISOString(),
        status: 'SCHEDULED',
      },
    });
    const lesson = await lessonRes.json();
    const lessonId = lesson.id || lesson.lesson?.id;
    expect(lessonId).toBeTruthy();

    // Studenti iscritti alla classe (dalla scheda classe)
    const classDetail = await (await page.request.get(`/api/classes/${classId}`)).json().catch(() => ({}));
    const studentList = classDetail.class?.students || classDetail.students || [];
    const records = studentList.slice(0, 3).map((s: any) => ({
      studentId: s.id,
      status: 'PRESENT',
    }));

    expect(records.length, 'la classe seed deve avere studenti iscritti').toBeGreaterThan(0);

    const res = await page.request.post('/api/attendance', {
      data: { lessonId, attendance: records },
    });
    expect(res.status(), await res.text()).toBeLessThan(400);
  });
});
