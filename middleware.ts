import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['it', 'en', 'fr', 'pt'],
  
  // Used when no locale matches
  defaultLocale: 'it'
});

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(it|en|fr|pt)/:path*']
};
