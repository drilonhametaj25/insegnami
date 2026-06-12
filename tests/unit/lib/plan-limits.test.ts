/**
 * Semantica unificata dei conteggi (A3.2): lib/plan-limits deve contare solo
 * le risorse ATTIVE (student status ACTIVE, teacher status ACTIVE, class
 * isActive true), come già fa lib/billing/plan-change. Add-on sommati ai
 * limiti del piano; limiti trial e no-subscription invariati.
 */

jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    student: { count: jest.fn() },
    teacher: { count: jest.fn() },
    class: { count: jest.fn() },
    tenantAddon: { findMany: jest.fn() },
  },
}));

import {
  checkStudentLimit,
  checkTeacherLimit,
  checkClassLimit,
  getTenantUsageWithLimits,
  getTenantPlanLimits,
} from '@/lib/plan-limits';
import { validatePlanChange } from '@/lib/billing/plan-change';

const { prisma } = require('@/lib/db');

const TENANT = 'tenant-1';

/** Configura i count mock: ritorna `active` se il where filtra le risorse attive, `total` altrimenti. */
function setupCounts({
  students,
  teachers,
  classes,
}: {
  students: { active: number; total: number };
  teachers: { active: number; total: number };
  classes: { active: number; total: number };
}) {
  prisma.student.count.mockImplementation(({ where }: any) =>
    Promise.resolve(where?.status === 'ACTIVE' ? students.active : students.total)
  );
  prisma.teacher.count.mockImplementation(({ where }: any) =>
    Promise.resolve(where?.status === 'ACTIVE' ? teachers.active : teachers.total)
  );
  prisma.class.count.mockImplementation(({ where }: any) =>
    Promise.resolve(where?.isActive === true ? classes.active : classes.total)
  );
}

function setupTenantWithPlan(plan: {
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
}) {
  prisma.tenant.findUnique.mockResolvedValue({
    id: TENANT,
    subscription: { plan },
    trialUntil: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.tenantAddon.findMany.mockResolvedValue([]);
});

describe('checkStudentLimit — conteggio solo ATTIVI', () => {
  it('10 studenti di cui 4 INACTIVE, limite 8 → allowed true con current 6', async () => {
    setupTenantWithPlan({ maxStudents: 8, maxTeachers: 5, maxClasses: 5 });
    setupCounts({
      students: { active: 6, total: 10 },
      teachers: { active: 0, total: 0 },
      classes: { active: 0, total: 0 },
    });

    const result = await checkStudentLimit(TENANT);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(6); // NON 10: i 4 INACTIVE non occupano posti
    expect(result.limit).toBe(8);
    expect(result.remaining).toBe(2);
  });

  it('nega quando gli attivi superano il limite', async () => {
    setupTenantWithPlan({ maxStudents: 8, maxTeachers: 5, maxClasses: 5 });
    setupCounts({
      students: { active: 9, total: 12 },
      teachers: { active: 0, total: 0 },
      classes: { active: 0, total: 0 },
    });

    const result = await checkStudentLimit(TENANT);
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(9);
  });
});

describe('checkTeacherLimit / checkClassLimit — conteggio solo ATTIVI', () => {
  it('docenti: conta solo status ACTIVE', async () => {
    setupTenantWithPlan({ maxStudents: 50, maxTeachers: 3, maxClasses: 5 });
    setupCounts({
      students: { active: 0, total: 0 },
      teachers: { active: 2, total: 5 },
      classes: { active: 0, total: 0 },
    });

    const result = await checkTeacherLimit(TENANT);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(2);
  });

  it('classi: conta solo isActive true', async () => {
    setupTenantWithPlan({ maxStudents: 50, maxTeachers: 5, maxClasses: 4 });
    setupCounts({
      students: { active: 0, total: 0 },
      teachers: { active: 0, total: 0 },
      classes: { active: 3, total: 7 },
    });

    const result = await checkClassLimit(TENANT);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(3);
  });
});

describe('add-on sommati al limite del piano', () => {
  it('limite effettivo = piano + quantity * unitSize degli add-on ACTIVE', async () => {
    setupTenantWithPlan({ maxStudents: 8, maxTeachers: 5, maxClasses: 5 });
    prisma.tenantAddon.findMany.mockResolvedValue([
      { type: 'EXTRA_STUDENTS', quantity: 2, unitSize: 5, status: 'ACTIVE' },
    ]);
    setupCounts({
      students: { active: 10, total: 14 },
      teachers: { active: 0, total: 0 },
      classes: { active: 0, total: 0 },
    });

    const result = await checkStudentLimit(TENANT);
    expect(result.limit).toBe(18); // 8 + 2*5
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
  });

  it('limite null (illimitato) resta illimitato anche con add-on', async () => {
    setupTenantWithPlan({ maxStudents: null, maxTeachers: null, maxClasses: null });
    prisma.tenantAddon.findMany.mockResolvedValue([
      { type: 'EXTRA_STUDENTS', quantity: 1, unitSize: 5, status: 'ACTIVE' },
    ]);
    const limits = await getTenantPlanLimits(TENANT);
    expect(limits).toEqual({ maxStudents: null, maxTeachers: null, maxClasses: null });
  });
});

describe('limiti trial e no-subscription invariati', () => {
  it('trial attivo → 50/10/20', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: TENANT,
      subscription: null,
      trialUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const limits = await getTenantPlanLimits(TENANT);
    expect(limits).toEqual({ maxStudents: 50, maxTeachers: 10, maxClasses: 20 });
  });

  it('nessuna subscription né trial → 10/2/5', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: TENANT,
      subscription: null,
      trialUntil: null,
    });
    const limits = await getTenantPlanLimits(TENANT);
    expect(limits).toEqual({ maxStudents: 10, maxTeachers: 2, maxClasses: 5 });
  });
});

describe('getTenantUsageWithLimits — usa i conteggi attivi', () => {
  it('riporta current = attivi, non totali', async () => {
    setupTenantWithPlan({ maxStudents: 10, maxTeachers: 10, maxClasses: 10 });
    setupCounts({
      students: { active: 6, total: 10 },
      teachers: { active: 2, total: 5 },
      classes: { active: 3, total: 7 },
    });

    const usage = await getTenantUsageWithLimits(TENANT);
    expect(usage?.students.current).toBe(6);
    expect(usage?.teachers.current).toBe(2);
    expect(usage?.classes.current).toBe(3);
    expect(usage?.students.percentage).toBe(60);
  });
});

describe('coerenza con validatePlanChange (stesso scenario, stesso verdetto)', () => {
  const plan = { name: 'Base', maxStudents: 8, maxTeachers: 5, maxClasses: 5 };

  it('6 attivi su limite 8 → entrambi permettono', async () => {
    setupTenantWithPlan(plan);
    setupCounts({
      students: { active: 6, total: 10 },
      teachers: { active: 1, total: 2 },
      classes: { active: 1, total: 2 },
    });

    const limitCheck = await checkStudentLimit(TENANT);
    const planChange = await validatePlanChange(TENANT, plan);

    expect(limitCheck.allowed).toBe(true);
    expect(planChange.allowed).toBe(true);
  });

  it('9 attivi su limite 8 → entrambi negano', async () => {
    setupTenantWithPlan(plan);
    setupCounts({
      students: { active: 9, total: 12 },
      teachers: { active: 1, total: 2 },
      classes: { active: 1, total: 2 },
    });

    const limitCheck = await checkStudentLimit(TENANT);
    const planChange = await validatePlanChange(TENANT, plan);

    expect(limitCheck.allowed).toBe(false);
    expect(planChange.allowed).toBe(false);
  });
});
