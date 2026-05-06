import type { Prisma, PrismaClient, Role } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * User-Profile Sync — keeps the User table aligned with the role-specific
 * tables (Student, Teacher).
 *
 * Why this exists:
 *
 * The schema has three lookup paths:
 *   - User              (auth identity)
 *   - UserTenant        (membership + role)
 *   - Student / Teacher (role-specific data: studentCode, hourlyRate, ...)
 *
 * Historically these were updated independently in different routes:
 *   POST /api/users     — created User+UserTenant only
 *   POST /api/students  — created Student (and optional User)
 *   POST /api/teachers  — created Teacher with NO User link (matched by email)
 *
 * Result: an admin creating a "Student" via /dashboard/users produced a
 * User row with role=STUDENT but NO Student row, so the student never
 * appeared in /dashboard/students. Same shape of bug for TEACHER.
 *
 * This service is the single chokepoint that closes the gap. Every API
 * that creates/updates a UserTenant.role calls into here, transactionally.
 *
 * Naming convention: `ensure*` is idempotent — call as many times as you
 * want, no duplicates created. `remove*` is also idempotent.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export type EnsureProfileInput = {
  userId: string;
  tenantId: string;
  role: Role;
  /** Used only when creating from scratch and the User firstName/lastName are blank. */
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
};

export type EnsureProfileResult = {
  studentCreated?: boolean;
  studentId?: string;
  teacherCreated?: boolean;
  teacherId?: string;
};

/**
 * Idempotent. If `role` corresponds to a profile-bearing role (STUDENT,
 * TEACHER), creates the matching profile row when missing and links it
 * to the User. Returns what was changed so the caller can shape the
 * response or trigger downstream automations.
 */
export async function ensureProfileForRole(
  tx: Tx,
  input: EnsureProfileInput,
): Promise<EnsureProfileResult> {
  const { userId, tenantId, role } = input;

  // Pull the User to fill in missing personal info (the caller may have
  // omitted these — in PUT flows the data lives entirely on User already).
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true, phone: true, status: true },
  });
  if (!user) {
    throw new Error(`ensureProfileForRole: user ${userId} not found`);
  }
  const firstName = input.firstName ?? user.firstName;
  const lastName = input.lastName ?? user.lastName;
  const email = input.email ?? user.email;
  const phone = input.phone ?? user.phone ?? null;

  if (role === 'STUDENT') {
    return ensureStudentProfile(tx, { userId, tenantId, firstName, lastName, email, phone, status: user.status });
  }
  if (role === 'TEACHER') {
    return ensureTeacherProfile(tx, { userId, tenantId, firstName, lastName, email, phone, status: user.status });
  }
  // ADMIN / DIRECTOR / SECRETARY / PARENT / SUPERADMIN don't have a
  // dedicated profile model. UserTenant.role is the source of truth.
  return {};
}

async function ensureStudentProfile(
  tx: Tx,
  args: { userId: string; tenantId: string; firstName: string; lastName: string; email: string; phone: string | null; status: string },
): Promise<EnsureProfileResult> {
  // Lookup: by userId first (canonical link), then by tenantId+email as
  // fallback for legacy data where the link wasn't set.
  let existing = await tx.student.findFirst({
    where: { userId: args.userId },
    select: { id: true, tenantId: true },
  });
  if (!existing && args.email) {
    existing = await tx.student.findFirst({
      // Prisma where on a nullable scalar uses { equals: null } at runtime,
      // but the generated type rejects it; cast to any (matches the rest
      // of the codebase pattern for nullable filters).
      where: { tenantId: args.tenantId, email: args.email, userId: null as any },
      select: { id: true, tenantId: true },
    });
    if (existing) {
      // Backfill the link so future lookups go through the canonical path.
      await tx.student.update({ where: { id: existing.id }, data: { userId: args.userId } });
    }
  }

  if (existing) {
    if (existing.tenantId !== args.tenantId) {
      // The User exists in a different tenant under role=STUDENT. We do NOT
      // move the Student record — that would lose history. Instead surface
      // the conflict to the caller.
      throw new Error(`Student record exists in another tenant for userId=${args.userId}`);
    }
    return { studentId: existing.id, studentCreated: false };
  }

  // Create. dateOfBirth is non-nullable; we use a placeholder that the user
  // is expected to correct from /dashboard/students/[id]/edit. This matches
  // the existing /api/students route behavior when the field is omitted.
  const studentCode = await generateStudentCode(tx, args.tenantId);
  const created = await tx.student.create({
    data: {
      tenantId: args.tenantId,
      userId: args.userId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: new Date('1900-01-01'),
      studentCode,
      status: (args.status as any) ?? 'ACTIVE',
    } as any,
    select: { id: true },
  });

  return { studentId: created.id, studentCreated: true };
}

async function ensureTeacherProfile(
  tx: Tx,
  args: { userId: string; tenantId: string; firstName: string; lastName: string; email: string; phone: string | null; status: string },
): Promise<EnsureProfileResult> {
  let existing = await tx.teacher.findFirst({
    where: { userId: args.userId },
    select: { id: true, tenantId: true },
  });
  if (!existing && args.email) {
    existing = await tx.teacher.findFirst({
      // Prisma where on a nullable scalar uses { equals: null } at runtime,
      // but the generated type rejects it; cast to any (matches the rest
      // of the codebase pattern for nullable filters).
      where: { tenantId: args.tenantId, email: args.email, userId: null as any },
      select: { id: true, tenantId: true },
    });
    if (existing) {
      await tx.teacher.update({ where: { id: existing.id }, data: { userId: args.userId } });
    }
  }

  if (existing) {
    if (existing.tenantId !== args.tenantId) {
      throw new Error(`Teacher record exists in another tenant for userId=${args.userId}`);
    }
    return { teacherId: existing.id, teacherCreated: false };
  }

  const teacherCode = await generateTeacherCode(tx, args.tenantId);
  const created = await tx.teacher.create({
    data: {
      tenantId: args.tenantId,
      userId: args.userId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      teacherCode,
      status: (args.status as any) ?? 'ACTIVE',
    } as any,
    select: { id: true },
  });

  return { teacherId: created.id, teacherCreated: true };
}

/**
 * When a user's role transitions AWAY from STUDENT/TEACHER (e.g. promoted
 * to ADMIN), we mark their profile INACTIVE rather than deleting it —
 * there's history attached (grades, payrolls, lessons) that must remain
 * referentially valid. The profile is then invisible to /dashboard/students
 * and /dashboard/teachers if those views filter on status, but accessible
 * to historical reports.
 */
export async function deactivateProfileForRoleChange(
  tx: Tx,
  args: { userId: string; tenantId: string; oldRole: Role; newRole: Role },
): Promise<{ deactivatedStudent: boolean; deactivatedTeacher: boolean }> {
  const { userId, tenantId, oldRole, newRole } = args;
  const out = { deactivatedStudent: false, deactivatedTeacher: false };

  if (oldRole === 'STUDENT' && newRole !== 'STUDENT') {
    const r = await tx.student.updateMany({
      where: { userId, tenantId, status: 'ACTIVE' as any },
      data: { status: 'INACTIVE' as any },
    });
    out.deactivatedStudent = r.count > 0;
  }
  if (oldRole === 'TEACHER' && newRole !== 'TEACHER') {
    const r = await tx.teacher.updateMany({
      where: { userId, tenantId, status: 'ACTIVE' as any },
      data: { status: 'INACTIVE' as any },
    });
    out.deactivatedTeacher = r.count > 0;
  }

  return out;
}

/**
 * Diagnostic: list inconsistencies between User+UserTenant and the profile
 * tables for a tenant (or all tenants when tenantId is null).
 *
 * Two flavors of orphan:
 *   - profileMissing: UserTenant.role ∈ {STUDENT, TEACHER} but no matching
 *     profile row → invisible to the role-specific dashboards
 *   - userMissing:    profile row exists but userId is null AND there's no
 *     User with the same email in this tenant → "ghost" profile
 */
export async function findOrphanedProfiles(tenantId: string | null) {
  const userTenantWhere: any = { role: { in: ['STUDENT', 'TEACHER'] } };
  if (tenantId) userTenantWhere.tenantId = tenantId;

  const userTenants = await prisma.userTenant.findMany({
    where: userTenantWhere,
    select: { userId: true, tenantId: true, role: true, user: { select: { email: true, firstName: true, lastName: true } } },
  });

  const profileMissing: Array<{ userId: string; tenantId: string; role: Role; email: string; firstName: string; lastName: string }> = [];

  for (const ut of userTenants) {
    if (ut.role === 'STUDENT') {
      const exists = await prisma.student.count({
        where: { OR: [{ userId: ut.userId }, { tenantId: ut.tenantId, email: ut.user.email }] },
      });
      if (exists === 0) {
        profileMissing.push({
          userId: ut.userId,
          tenantId: ut.tenantId,
          role: ut.role as Role,
          email: ut.user.email,
          firstName: ut.user.firstName,
          lastName: ut.user.lastName,
        });
      }
    } else if (ut.role === 'TEACHER') {
      const exists = await prisma.teacher.count({
        where: { OR: [{ userId: ut.userId }, { tenantId: ut.tenantId, email: ut.user.email }] },
      });
      if (exists === 0) {
        profileMissing.push({
          userId: ut.userId,
          tenantId: ut.tenantId,
          role: ut.role as Role,
          email: ut.user.email,
          firstName: ut.user.firstName,
          lastName: ut.user.lastName,
        });
      }
    }
  }

  // Profiles with no User link — typically legacy Teacher rows (the link
  // didn't exist before). For these we report them so an admin can decide:
  // create a User account, or delete the orphan profile.
  const teachersWithoutUser = await prisma.teacher.findMany({
    where: { userId: null, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, tenantId: true, firstName: true, lastName: true, email: true },
  });

  return { profileMissing, teachersWithoutUser };
}

/**
 * Repair: walk every orphan reported by findOrphanedProfiles and create
 * the missing profile. Idempotent — safe to run repeatedly. Returns
 * counts so you can include them in script output / logs.
 */
export async function repairOrphanedProfiles(tenantId: string | null): Promise<{ studentsCreated: number; teachersCreated: number }> {
  const { profileMissing } = await findOrphanedProfiles(tenantId);

  let studentsCreated = 0;
  let teachersCreated = 0;

  for (const orphan of profileMissing) {
    const result = await prisma.$transaction(async (tx) => {
      return ensureProfileForRole(tx, {
        userId: orphan.userId,
        tenantId: orphan.tenantId,
        role: orphan.role,
      });
    });
    if (result.studentCreated) studentsCreated += 1;
    if (result.teacherCreated) teachersCreated += 1;
  }

  return { studentsCreated, teachersCreated };
}

// ---- Code generators (per-tenant, monotonic + collision-safe) ----
//
// Schema declares `studentCode @unique` and `teacherCode @unique` GLOBALLY
// (not per-tenant). Two tenants both starting at 1 would collide. We
// generate a sequence based on the per-tenant count and verify uniqueness;
// on collision we append a short random suffix and retry up to 5 times.

async function generateStudentCode(tx: Tx, tenantId: string): Promise<string> {
  const base = `S${String((await tx.student.count({ where: { tenantId } })) + 1).padStart(4, '0')}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix(3)}`;
    const exists = await tx.student.findUnique({ where: { studentCode: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  // Last resort: fully random.
  return `S-${randomSuffix(8)}`;
}

async function generateTeacherCode(tx: Tx, tenantId: string): Promise<string> {
  const base = `T${String((await tx.teacher.count({ where: { tenantId } })) + 1).padStart(4, '0')}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix(3)}`;
    const exists = await tx.teacher.findUnique({ where: { teacherCode: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `T-${randomSuffix(8)}`;
}

function randomSuffix(len: number): string {
  const chars = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // no I/L/O/0/1 to avoid OCR mistakes
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
