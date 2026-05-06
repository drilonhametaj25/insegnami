import type { Role } from '@prisma/client';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'manage' | 'export';

export type Resource =
  | 'tenant'
  | 'subscription'
  | 'plan'
  | 'user'
  | 'student'
  | 'teacher'
  | 'parent'
  | 'class'
  | 'course'
  | 'subject'
  | 'lesson'
  | 'attendance'
  | 'grade'
  | 'reportCard'
  | 'homework'
  | 'homeworkSubmission'
  | 'disciplinaryNote'
  | 'parentMeeting'
  | 'payment'
  | 'invoice'
  | 'payroll'
  | 'accounting'
  | 'analytics'
  | 'notice'
  | 'message'
  | 'notification'
  | 'document'
  | 'material'
  | 'auditLog'
  | 'settings'
  | 'schedule'
  | 'academicYear'
  | 'holiday';

const allActions: Action[] = ['read', 'create', 'update', 'delete', 'manage', 'export'];

function full(resources: Resource[]): Record<Resource, Action[]> {
  return Object.fromEntries(resources.map((r) => [r, allActions])) as Record<Resource, Action[]>;
}

function readOnly(resources: Resource[]): Record<Resource, Action[]> {
  return Object.fromEntries(resources.map((r) => [r, ['read'] as Action[]])) as Record<Resource, Action[]>;
}

function merge(...maps: Record<string, Action[]>[]): Record<string, Action[]> {
  const out: Record<string, Action[]> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      out[k] = Array.from(new Set([...(out[k] ?? []), ...v]));
    }
  }
  return out;
}

const allResources: Resource[] = [
  'tenant', 'subscription', 'plan', 'user', 'student', 'teacher', 'parent',
  'class', 'course', 'subject', 'lesson', 'attendance', 'grade', 'reportCard',
  'homework', 'homeworkSubmission', 'disciplinaryNote', 'parentMeeting',
  'payment', 'invoice', 'payroll', 'accounting', 'analytics', 'notice',
  'message', 'notification', 'document', 'material', 'auditLog', 'settings',
  'schedule', 'academicYear', 'holiday',
];

const SUPERADMIN_PERMS = full(allResources);

const ADMIN_PERMS = full(allResources.filter((r) => r !== 'tenant' && r !== 'plan'));

const DIRECTOR_PERMS = merge(
  full([
    'student', 'teacher', 'parent', 'class', 'course', 'subject', 'lesson',
    'attendance', 'grade', 'reportCard', 'homework', 'disciplinaryNote',
    'parentMeeting', 'notice', 'message', 'notification', 'document',
    'material', 'schedule', 'academicYear', 'holiday', 'analytics',
  ]),
  readOnly(['payment', 'invoice', 'payroll', 'accounting', 'auditLog', 'settings', 'subscription']),
);

const SECRETARY_PERMS = merge(
  full([
    'student', 'parent', 'payment', 'invoice', 'document', 'notice',
    'message', 'notification', 'parentMeeting',
  ]),
  {
    teacher: ['read', 'create', 'update'] as Action[],
    class: ['read', 'create', 'update'] as Action[],
    course: ['read', 'create', 'update'] as Action[],
    subject: ['read'] as Action[],
    lesson: ['read', 'create', 'update'] as Action[],
    attendance: ['read', 'export'] as Action[],
    grade: ['read'] as Action[],
    reportCard: ['read', 'export'] as Action[],
    homework: ['read'] as Action[],
    schedule: ['read'] as Action[],
    academicYear: ['read'] as Action[],
    holiday: ['read'] as Action[],
    material: ['read'] as Action[],
    accounting: ['read'] as Action[],
    analytics: ['read'] as Action[],
  },
);

const TEACHER_PERMS: Record<string, Action[]> = {
  student: ['read'],
  parent: ['read'],
  class: ['read'],
  course: ['read'],
  subject: ['read'],
  lesson: ['read', 'create', 'update'],
  attendance: ['read', 'create', 'update', 'export'],
  grade: ['read', 'create', 'update', 'delete'],
  reportCard: ['read', 'create', 'update'],
  homework: ['read', 'create', 'update', 'delete'],
  homeworkSubmission: ['read', 'update'],
  disciplinaryNote: ['read', 'create', 'update'],
  parentMeeting: ['read', 'create', 'update'],
  notice: ['read', 'create'],
  message: ['read', 'create', 'update'],
  notification: ['read', 'update'],
  document: ['read'],
  material: ['read', 'create', 'update', 'delete'],
  schedule: ['read'],
  academicYear: ['read'],
  holiday: ['read'],
  teacher: ['read'],
};

const STUDENT_PERMS: Record<string, Action[]> = {
  class: ['read'],
  course: ['read'],
  subject: ['read'],
  lesson: ['read'],
  attendance: ['read'],
  grade: ['read'],
  reportCard: ['read'],
  homework: ['read'],
  homeworkSubmission: ['read', 'create', 'update'],
  disciplinaryNote: ['read'],
  notice: ['read'],
  message: ['read', 'create'],
  notification: ['read', 'update'],
  document: ['read'],
  material: ['read'],
  schedule: ['read'],
  academicYear: ['read'],
  holiday: ['read'],
  payment: ['read'],
  parentMeeting: ['read'],
  teacher: ['read'],
};

const PARENT_PERMS: Record<string, Action[]> = {
  student: ['read'],
  class: ['read'],
  course: ['read'],
  lesson: ['read'],
  attendance: ['read'],
  grade: ['read'],
  reportCard: ['read'],
  homework: ['read'],
  disciplinaryNote: ['read'],
  parentMeeting: ['read', 'create', 'update'],
  notice: ['read'],
  message: ['read', 'create'],
  notification: ['read', 'update'],
  payment: ['read'],
  invoice: ['read'],
  document: ['read'],
  material: ['read'],
  schedule: ['read'],
  academicYear: ['read'],
  holiday: ['read'],
  teacher: ['read'],
};

export const PERMISSIONS: Record<Role, Record<string, Action[]>> = {
  SUPERADMIN: SUPERADMIN_PERMS as Record<string, Action[]>,
  ADMIN: ADMIN_PERMS as Record<string, Action[]>,
  DIRECTOR: DIRECTOR_PERMS,
  SECRETARY: SECRETARY_PERMS,
  TEACHER: TEACHER_PERMS,
  STUDENT: STUDENT_PERMS,
  PARENT: PARENT_PERMS,
};

export function can(role: Role | string | undefined, action: Action, resource: Resource): boolean {
  if (!role) return false;
  const perms = PERMISSIONS[role as Role];
  if (!perms) return false;
  const actions = perms[resource];
  if (!actions) return false;
  return actions.includes(action) || actions.includes('manage');
}

export function canAny(role: Role | string | undefined, actions: Action[], resource: Resource): boolean {
  return actions.some((a) => can(role, a, resource));
}

export function assertCan(role: Role | string | undefined, action: Action, resource: Resource): void {
  if (!can(role, action, resource)) {
    const r = role ?? '<no role>';
    throw new ForbiddenError(`Role ${r} cannot ${action} ${resource}`);
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
