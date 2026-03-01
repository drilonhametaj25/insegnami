import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

interface AuthResult {
  authorized: boolean;
  session: Awaited<ReturnType<typeof getAuth>>;
  errorResponse?: NextResponse;
}

/**
 * Check if the current user is authenticated as SUPERADMIN
 * Returns an error response if not authorized, or the session if authorized
 */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const session = await getAuth();

  if (!session?.user) {
    return {
      authorized: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      ),
    };
  }

  if (session.user.role !== 'SUPERADMIN') {
    return {
      authorized: false,
      session,
      errorResponse: NextResponse.json(
        { error: 'Accesso negato. Solo SUPERADMIN.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}

/**
 * Check if the current user is authenticated (any role)
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getAuth();

  if (!session?.user) {
    return {
      authorized: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}

/**
 * Check if the current user has one of the specified roles
 */
export async function requireRoles(roles: string[]): Promise<AuthResult> {
  const session = await getAuth();

  if (!session?.user) {
    return {
      authorized: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      ),
    };
  }

  if (!roles.includes(session.user.role)) {
    return {
      authorized: false,
      session,
      errorResponse: NextResponse.json(
        { error: `Accesso negato. Ruoli richiesti: ${roles.join(', ')}` },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}
