import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { eraseUser } from '@/lib/gdpr/erase';

/**
 * GET /api/auth/me — return the authenticated user's identity (for clients
 * that want a server-side ground-truth instead of decoding the JWT).
 */
export async function GET() {
  const session = await getAuth();
  if (!session?.user?.id) {
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
    },
  });
}

/**
 * DELETE /api/auth/me — GDPR Art.17 right-to-erasure self-service.
 *
 * Anonymizes the User + linked Student profile and deletes their personal
 * notifications/messages. Financial documents (Payment, Invoice) and
 * grades/report-cards are RETAINED under legal hold (10 years IT) — see
 * lib/gdpr/erase.ts for the full retention policy.
 *
 * After erasure the user can no longer log in (password locked to a
 * fresh random hash). The browser session cookie is left for the client
 * to clear via signOut() — we don't try to invalidate JWTs server-side
 * since NextAuth uses stateless tokens.
 */
export async function DELETE() {
  const session = await getAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  try {
    const result = await eraseUser(session.user.id, {
      triggeredBy: session.user.id,
      reason: 'self-service via /api/auth/me DELETE',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
