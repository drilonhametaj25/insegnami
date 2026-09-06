import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import type { Role } from '@prisma/client';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can, type Action, type Resource } from '@/lib/permissions/matrix';
import { getTenantAccessCached } from '@/lib/tenant-access';
import { hasFeature, type FeatureKey } from '@/lib/billing/features';

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
  /**
   * Feature di piano richiesta (lib/billing/features.ts). Se il piano del
   * tenant non la include → 403 con code 'feature-not-in-plan': la UI la
   * intercetta e mostra l'upsell. SUPERADMIN bypassa.
   */
  feature?: FeatureKey;
  allowSuperAdminCrossTenant?: boolean;
  /**
   * Salta l'enforcement dello stato commerciale del tenant. Riservato alle
   * route che devono restare accessibili anche a tenant bloccati (diritti
   * GDPR: export/erasure non decadono col mancato pagamento).
   */
  skipTenantAccessCheck?: boolean;
};

export class AuthError extends Error {
  constructor(
    public status: 401 | 402 | 403,
    message: string,
    public code?: string
  ) {
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

  // Enforcement stato commerciale (trial scaduto, moroso, cancellato):
  // 402 con code → la UI redirige a /dashboard/billing.
  if (!opts.skipTenantAccessCheck && !ctx.isSuperAdmin) {
    const verdict = await getTenantAccessCached(ctx.tenantId);
    if (!verdict.ok) {
      throw new AuthError(
        verdict.reason === 'tenant-inactive' || verdict.reason === 'tenant-not-found' ? 403 : 402,
        'Accesso sospeso: verifica lo stato del tuo abbonamento.',
        verdict.reason
      );
    }
  }

  // Feature gating di piano: 403 con code dedicato → upsell in UI
  if (opts.feature && !ctx.isSuperAdmin) {
    const enabled = await hasFeature(ctx.tenantId, opts.feature);
    if (!enabled) {
      throw new AuthError(403, 'Funzionalità non inclusa nel tuo piano', 'feature-not-in-plan');
    }
  }

  return ctx;
}

export function authError(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message, ...(err.code ? { code: err.code } : {}) },
      { status: err.status }
    );
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
 * Lookup primario sulla FK Teacher.userId (robusta ai cambi email);
 * fallback legacy su email + tenantId per i record non ancora backfillati.
 * Sempre scoped per tenantId (nessun leak cross-tenant).
 *
 * Returns null if the current user is not a teacher in this tenant.
 */
const teacherCache = new WeakMap<AuthContext, string | null>();
export async function getTeacherIdForUser(ctx: AuthContext): Promise<string | null> {
  if (teacherCache.has(ctx)) return teacherCache.get(ctx) ?? null;

  let teacher = await prisma.teacher.findFirst({
    where: {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    },
    select: { id: true },
  });

  if (!teacher && ctx.email) {
    teacher = await prisma.teacher.findFirst({
      where: {
        email: ctx.email,
        tenantId: ctx.tenantId,
      },
      select: { id: true },
    });
  }

  const id = teacher?.id ?? null;
  teacherCache.set(ctx, id);
  return id;
}

/**
 * Id degli studenti di cui l'utente corrente è tutore (StudentGuardian),
 * con fallback legacy su Student.parentUserId per i dati non backfillati.
 * È l'UNICO punto da cui i filtri "solo i miei figli" devono passare.
 */
const childrenCache = new WeakMap<AuthContext, string[]>();
export async function getChildStudentIds(ctx: AuthContext): Promise<string[]> {
  const cached = childrenCache.get(ctx);
  if (cached) return cached;

  const [links, legacy] = await Promise.all([
    prisma.studentGuardian.findMany({
      where: { userId: ctx.userId, tenantId: ctx.tenantId },
      select: { studentId: true },
    }),
    prisma.student.findMany({
      where: { parentUserId: ctx.userId, tenantId: ctx.tenantId },
      select: { id: true },
    }),
  ]);

  const ids = Array.from(
    new Set([...links.map((l) => l.studentId), ...legacy.map((s) => s.id)])
  );
  childrenCache.set(ctx, ids);
  return ids;
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
