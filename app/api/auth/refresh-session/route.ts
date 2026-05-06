import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

/**
 * POST /api/auth/refresh-session
 *
 * Returns the current session payload. Useful as a server-side ping that
 * forces NextAuth to re-evaluate the JWT (e.g. right after another tab or
 * an admin action changed the user's role / status / tenant).
 *
 * The actual JWT refresh happens in the jwt callback when triggered by
 * useSession().update() on the client. This endpoint exists so server
 * components / API consumers can read the canonical session shape after
 * a known mutation without having to import next-auth's react helpers.
 */
export async function POST() {
  const session = await getAuth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      tenantId: session.user.tenantId,
      tenantName: session.user.tenantName,
      avatar: session.user.avatar,
    },
  });
}
