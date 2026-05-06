/**
 * Repair User ↔ Student/Teacher orphans.
 *
 * Background: before lib/user-profile-sync.ts existed, creating a STUDENT
 * or TEACHER from /dashboard/users left a User+UserTenant row but no
 * Student/Teacher profile, so the role-specific dashboards never showed
 * them. This script walks every UserTenant with role STUDENT/TEACHER,
 * creates the missing profile, and back-links any legacy profile that
 * has email but no userId.
 *
 * Run via:
 *   npx tsx scripts/repair-user-profiles.ts                     # all tenants
 *   npx tsx scripts/repair-user-profiles.ts --tenant <tenantId> # single tenant
 *   npx tsx scripts/repair-user-profiles.ts --dry-run           # report only
 *
 * Idempotent — safe to re-run.
 */

import { findOrphanedProfiles, repairOrphanedProfiles } from '@/lib/user-profile-sync';

async function main() {
  const args = process.argv.slice(2);
  const tenantArg = args.indexOf('--tenant');
  const tenantId = tenantArg >= 0 ? args[tenantArg + 1] : null;
  const dryRun = args.includes('--dry-run');

  console.log(`[repair-user-profiles] ${dryRun ? 'DRY RUN — ' : ''}scanning tenant=${tenantId ?? 'ALL'}`);

  const orphans = await findOrphanedProfiles(tenantId);
  console.log(`Found ${orphans.profileMissing.length} role-with-no-profile, ${orphans.teachersWithoutUser.length} teachers-without-user`);

  if (orphans.profileMissing.length === 0 && orphans.teachersWithoutUser.length === 0) {
    console.log('Nothing to repair.');
    return;
  }

  console.log('\n--- profileMissing ---');
  for (const o of orphans.profileMissing) {
    console.log(`  ${o.role.padEnd(8)} ${o.email.padEnd(40)} ${o.firstName} ${o.lastName}  (tenantId=${o.tenantId})`);
  }
  if (orphans.teachersWithoutUser.length > 0) {
    console.log('\n--- teachersWithoutUser (no auto-fix; admin must create User account) ---');
    for (const t of orphans.teachersWithoutUser) {
      console.log(`  ${t.email.padEnd(40)} ${t.firstName} ${t.lastName}  (teacherId=${t.id}, tenantId=${t.tenantId})`);
    }
  }

  if (dryRun) {
    console.log('\nDry run — no changes made.');
    return;
  }

  console.log('\nApplying fixes...');
  const result = await repairOrphanedProfiles(tenantId);
  console.log(`Created ${result.studentsCreated} Student profiles, ${result.teachersCreated} Teacher profiles.`);

  if (orphans.teachersWithoutUser.length > 0) {
    console.log('\nNote: teachersWithoutUser were NOT auto-fixed. Admin must create User accounts for these.');
  }
}

main()
  .catch((err) => {
    console.error('repair-user-profiles failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('@/lib/db');
    await prisma.$disconnect();
  });
