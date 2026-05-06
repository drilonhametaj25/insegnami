import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { findOrphanedProfiles, repairOrphanedProfiles } from '@/lib/user-profile-sync';

/**
 * GET  /api/superadmin/profile-orphans?tenantId=...   — diagnostic
 * POST /api/superadmin/profile-orphans?tenantId=...   — apply repairs
 *
 * Limited to SUPERADMIN because the report can include data across tenants
 * and the repair operation creates DB rows. Tenant filtering optional —
 * omit `tenantId` to scan everything.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ roles: ['SUPERADMIN'] });
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const orphans = await findOrphanedProfiles(tenantId);
    return NextResponse.json({
      scope: tenantId ?? 'all-tenants',
      profileMissingCount: orphans.profileMissing.length,
      teachersWithoutUserCount: orphans.teachersWithoutUser.length,
      ...orphans,
      requestedBy: ctx.userId,
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('profile-orphans GET error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth({ roles: ['SUPERADMIN'] });
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const result = await repairOrphanedProfiles(tenantId);
    return NextResponse.json({
      scope: tenantId ?? 'all-tenants',
      ...result,
    });
  } catch (err) {
    const r = authError(err);
    if (r) return r;
    console.error('profile-orphans POST error', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
