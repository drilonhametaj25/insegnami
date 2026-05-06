import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import type { Role } from '@prisma/client';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can, type Action, type Resource } from '@/lib/permissions/matrix';

export type AuthContext = {
  session: Session;
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  isSuperAdmin: boolean;
};

export type RequireAuthOptions = {
  roles?: Role[];
  permission?: { action: Action; resource: Resource };
  allowSuperAdminCrossTenant?: boolean;
};

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireAuth(opts: RequireAuthOptions = {}): Promise<AuthContext> {
  const session = await getAuth();
  if (!session?.user || !session.user.id || !session.user.tenantId) {
    throw new AuthError(401, 'Unauthorized');
  }

  const ctx: AuthContext = {
    session,
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role as Role,
    email: session.user.email ?? '',
    isSuperAdmin: session.user.role === 'SUPERADMIN',
  };

  if (opts.roles && !opts.roles.includes(ctx.role)) {
    throw new AuthError(403, 'Forbidden');
  }

  if (opts.permission && !can(ctx.role, opts.permission.action, opts.permission.resource)) {
    throw new AuthError(403, 'Forbidden');
  }

  return ctx;
}

export function authError(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/**
 * Build a tenant-scoped Prisma where clause.
 * SUPERADMIN bypasses tenant scope unless overrideTenantId is supplied.
 */
export function tenantScope(ctx: AuthContext, base: Record<string, any> = {}, overrideTenantId?: string): Record<string, any> {
  if (ctx.isSuperAdmin) {
    if (overrideTenantId) return { ...base, tenantId: overrideTenantId };
    return base;
  }
  return { ...base, tenantId: ctx.tenantId };
}

/**
 * Resolve the Teacher record linked to the current authenticated User.
 *
 * Schema note: Teacher has no userId FK — link is by email + tenantId.
 * This helper is the ONLY safe place to do that lookup, because it always
 * scopes by tenantId (preventing cross-tenant leak when two tenants
 * happen to have a teacher with the same email).
 *
 * Returns null if the current user is not a teacher in this tenant.
 */
const teacherCache = new WeakMap<AuthContext, string | null>();
export async function getTeacherIdForUser(ctx: AuthContext): Promise<string | null> {
  if (teacherCache.has(ctx)) return teacherCache.get(ctx) ?? null;

  if (!ctx.email) {
    teacherCache.set(ctx, null);
    return null;
  }

  const teacher = await prisma.teacher.findFirst({
    where: {
      email: ctx.email,
      tenantId: ctx.tenantId,
    },
    select: { id: true },
  });

  const id = teacher?.id ?? null;
  teacherCache.set(ctx, id);
  return id;
}

/**
 * Resolve the Student record linked to the current authenticated User.
 * Uses Student.userId FK (set when student account was created).
 */
export async function getStudentIdForUser(ctx: AuthContext): Promise<string | null> {
  const student = await prisma.student.findFirst({
    where: {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    } as any,
    select: { id: true },
  });
  return student?.id ?? null;
}
