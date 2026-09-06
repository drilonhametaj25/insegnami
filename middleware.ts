import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { roleGuard } from '@/lib/auth-middleware';

const locales = ['it', 'en', 'fr', 'pt'];

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ['it', 'en', 'fr', 'pt'],

  // Used when no locale matches
  defaultLocale: 'it',

  // Always redirect to add locale prefix
  localePrefix: 'always'
});

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow root path to show landing page
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Don't process API routes, _next, and static files
  if (pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.includes('.')) {
    return NextResponse.next();
  }

  const intlResponse = intlMiddleware(request);

  // Path senza prefisso locale
  const maybeLocale = pathname.split('/')[1];
  const hasLocale = locales.includes(maybeLocale);
  const locale = hasLocale ? maybeLocale : 'it';
  const pathWithoutLocale = hasLocale
    ? pathname.slice(maybeLocale.length + 1) || '/'
    : pathname;

  if (pathWithoutLocale.startsWith('/dashboard')) {
    // In produzione Auth.js usa il cookie con prefisso __Secure-: lo si deduce
    // dalla presenza del cookie stesso (cookieName e salt seguono secureCookie).
    const secureCookie = request.cookies.has('__Secure-authjs.session-token');
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      secureCookie,
    });

    if (!token) {
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const guard = roleGuard(pathWithoutLocale, locale, token.role as string | undefined, request.url);
    if (guard) return guard;
  }

  return intlResponse;
}

export const config = {
  // More specific matcher
  matcher: [
    '/',
    '/(it|en|fr|pt)',
    '/(it|en|fr|pt)/:path*',
    '/((?!api|_next|_vercel|.*\\.).*)'
  ]
};
