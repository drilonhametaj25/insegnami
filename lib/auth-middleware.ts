import { NextResponse } from 'next/server';

// Eseguito su edge runtime: niente DB/Prisma/auth() qui — il ruolo arriva
// dal token JWT letto in middleware.ts.

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'];

// Regole per prefisso sul path SENZA locale. Primo match vince: i prefissi
// più specifici vanno prima (es. /dashboard/teachers prima di /dashboard/teacher).
const ROUTE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/dashboard/superadmin', roles: ['SUPERADMIN'] },
  { prefix: '/dashboard/admin', roles: ADMIN_ROLES },
  { prefix: '/dashboard/users', roles: ADMIN_ROLES },
  { prefix: '/dashboard/settings', roles: ADMIN_ROLES },
  { prefix: '/dashboard/accounting', roles: ADMIN_ROLES },
  { prefix: '/dashboard/invoices', roles: ADMIN_ROLES },
  { prefix: '/dashboard/analytics', roles: ADMIN_ROLES },
  { prefix: '/dashboard/teachers', roles: ADMIN_ROLES },
  // I docenti accedono ai propri cedolini
  { prefix: '/dashboard/payroll', roles: [...ADMIN_ROLES, 'TEACHER'] },
  { prefix: '/dashboard/teacher', roles: [...ADMIN_ROLES, 'TEACHER'] },
  { prefix: '/dashboard/student', roles: [...ADMIN_ROLES, 'STUDENT'] },
  { prefix: '/dashboard/parent', roles: [...ADMIN_ROLES, 'PARENT'] },
];

// Match su confine di segmento: '/dashboard/teacher' non deve catturare '/dashboard/teachers'
function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Guardia ruoli per le pagine dashboard.
 * Ritorna un redirect a /{locale}/dashboard se il ruolo non è autorizzato
 * per il path richiesto, altrimenti null (continua).
 */
export function roleGuard(
  pathWithoutLocale: string,
  locale: string,
  role: string | undefined,
  requestUrl: string | URL
): NextResponse | null {
  const rule = ROUTE_RULES.find((r) => matchesPrefix(pathWithoutLocale, r.prefix));
  if (!rule) return null;
  if (role && rule.roles.includes(role)) return null;
  return NextResponse.redirect(new URL(`/${locale}/dashboard`, requestUrl));
}
