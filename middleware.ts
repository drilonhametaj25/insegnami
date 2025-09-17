import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ['it', 'en', 'fr', 'pt'],
  
  // Used when no locale matches
  defaultLocale: 'it',
  
  // Always redirect to add locale prefix
  localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Force redirect from root path to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/it/dashboard', request.url));
  }
  
  // Force redirect from locale root paths (e.g., /it, /en) to dashboard
  const localeRootMatch = pathname.match(/^\/([a-z]{2})$/);
  if (localeRootMatch) {
    return NextResponse.redirect(new URL(`/${localeRootMatch[1]}/dashboard`, request.url));
  }
  
  // Don't process API routes, _next, and static files
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.includes('.')) {
    return NextResponse.next();
  }
  
  return intlMiddleware(request);
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
