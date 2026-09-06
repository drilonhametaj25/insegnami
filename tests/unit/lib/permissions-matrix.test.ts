/**
 * Matrice permessi (lib/permissions/matrix.ts): snapshot completo di tutti i
 * 7 ruoli × risorse × azioni + assert mirati sui casi delicati. Ogni modifica
 * alla matrice produce un diff di snapshot da approvare esplicitamente
 * (npx jest -u solo dopo revisione).
 */

import { PERMISSIONS, can, canAny, assertCan, ForbiddenError } from '@/lib/permissions/matrix';

describe('PERMISSIONS — snapshot completo', () => {
  it('la matrice non cambia senza approvazione esplicita', () => {
    // normalizza (ordina le azioni) per uno snapshot stabile
    const normalized = Object.fromEntries(
      Object.entries(PERMISSIONS).map(([role, perms]) => [
        role,
        Object.fromEntries(
          Object.entries(perms)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([resource, actions]) => [resource, [...actions].sort()])
        ),
      ])
    );
    expect(normalized).toMatchSnapshot();
  });

  it('tutti e 7 i ruoli sono definiti', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual([
      'ADMIN',
      'DIRECTOR',
      'PARENT',
      'SECRETARY',
      'STUDENT',
      'SUPERADMIN',
      'TEACHER',
    ]);
  });
});

describe('casi delicati per ruolo', () => {
  it('DIRECTOR è read-only su finanza e impostazioni', () => {
    for (const resource of ['payment', 'invoice', 'payroll', 'accounting', 'settings', 'subscription'] as const) {
      expect(can('DIRECTOR', 'read', resource)).toBe(true);
      expect(can('DIRECTOR', 'create', resource)).toBe(false);
      expect(can('DIRECTOR', 'update', resource)).toBe(false);
      expect(can('DIRECTOR', 'delete', resource)).toBe(false);
    }
  });

  it('DIRECTOR ha pieni poteri sul didattico', () => {
    for (const resource of ['student', 'teacher', 'class', 'lesson', 'grade', 'reportCard', 'schedule'] as const) {
      expect(can('DIRECTOR', 'manage', resource)).toBe(true);
    }
  });

  it('SECRETARY gestisce anagrafiche/pagamenti ma non scrive voti né vede paghe', () => {
    expect(can('SECRETARY', 'create', 'student')).toBe(true);
    expect(can('SECRETARY', 'create', 'payment')).toBe(true);
    expect(can('SECRETARY', 'create', 'invoice')).toBe(true);
    expect(can('SECRETARY', 'read', 'grade')).toBe(true);
    expect(can('SECRETARY', 'create', 'grade')).toBe(false);
    expect(can('SECRETARY', 'update', 'grade')).toBe(false);
    expect(can('SECRETARY', 'read', 'payroll')).toBe(false);
    expect(can('SECRETARY', 'delete', 'teacher')).toBe(false);
  });

  it('STUDENT e PARENT non hanno analytics né payroll né accounting', () => {
    for (const role of ['STUDENT', 'PARENT'] as const) {
      expect(can(role, 'read', 'analytics')).toBe(false);
      expect(can(role, 'read', 'payroll')).toBe(false);
      expect(can(role, 'read', 'accounting')).toBe(false);
      expect(can(role, 'read', 'auditLog')).toBe(false);
      expect(can(role, 'create', 'lesson')).toBe(false);
      expect(can(role, 'delete', 'grade')).toBe(false);
    }
  });

  it('STUDENT può consegnare i compiti ma non crearli', () => {
    expect(can('STUDENT', 'create', 'homeworkSubmission')).toBe(true);
    expect(can('STUDENT', 'create', 'homework')).toBe(false);
  });

  it('PARENT può richiedere colloqui e leggere fatture, STUDENT no sulle fatture', () => {
    expect(can('PARENT', 'create', 'parentMeeting')).toBe(true);
    expect(can('PARENT', 'read', 'invoice')).toBe(true);
    expect(can('STUDENT', 'read', 'invoice')).toBe(false);
  });

  it('TEACHER: registro pieno, payroll solo lettura (propri cedolini), niente payment', () => {
    expect(can('TEACHER', 'create', 'attendance')).toBe(true);
    expect(can('TEACHER', 'create', 'grade')).toBe(true);
    expect(can('TEACHER', 'create', 'disciplinaryNote')).toBe(true);
    expect(can('TEACHER', 'read', 'payroll')).toBe(true);
    expect(can('TEACHER', 'create', 'payroll')).toBe(false);
    expect(can('TEACHER', 'read', 'payment')).toBe(false);
    expect(can('TEACHER', 'delete', 'student')).toBe(false);
  });

  it('ADMIN ha tutto tranne tenant e plan; SUPERADMIN ha tutto', () => {
    expect(can('ADMIN', 'manage', 'payroll')).toBe(true);
    expect(can('ADMIN', 'manage', 'tenant')).toBe(false);
    expect(can('ADMIN', 'manage', 'plan')).toBe(false);
    expect(can('SUPERADMIN', 'manage', 'tenant')).toBe(true);
    expect(can('SUPERADMIN', 'manage', 'plan')).toBe(true);
  });
});

describe('helper can/canAny/assertCan', () => {
  it('can è falso per ruolo/risorsa/azione ignoti', () => {
    expect(can(undefined, 'read', 'student')).toBe(false);
    expect(can('NOPE', 'read', 'student')).toBe(false);
    expect(can('ADMIN', 'read', 'inesistente' as never)).toBe(false);
  });

  it('manage implica ogni azione', () => {
    expect(can('ADMIN', 'export', 'payment')).toBe(true);
  });

  it('canAny è vero se almeno una azione è concessa', () => {
    expect(canAny('SECRETARY', ['create', 'update'], 'grade')).toBe(false);
    expect(canAny('SECRETARY', ['read', 'update'], 'grade')).toBe(true);
  });

  it('assertCan lancia ForbiddenError con ruolo e risorsa nel messaggio', () => {
    expect(() => assertCan('STUDENT', 'delete', 'grade')).toThrow(ForbiddenError);
    expect(() => assertCan('STUDENT', 'delete', 'grade')).toThrow(/STUDENT.*delete.*grade/);
    expect(() => assertCan('ADMIN', 'read', 'student')).not.toThrow();
  });
});
