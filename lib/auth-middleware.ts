import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSaaSMode } from "@/lib/config";

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Extract locale from pathname
  const locale = pathname.split('/')[1];
  const locales = ['it', 'en', 'fr', 'pt'];
  const currentLocale = locales.includes(locale) ? locale : 'it';
  
  // Remove locale from pathname for route checking
  const pathWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/';

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/error'];

  try {
    const session = await auth();
    
    // Handle root path redirect
    if (pathWithoutLocale === '/') {
      if (session) {
        return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
      } else {
        return NextResponse.redirect(new URL(`/${currentLocale}/auth/login`, request.url));
      }
    }
    
    // SaaS mode: disable registration in self-hosted mode
    if (!isSaaSMode && pathWithoutLocale === '/auth/register') {
      return NextResponse.redirect(new URL(`/${currentLocale}/auth/login`, request.url));
    }

    // If not authenticated and trying to access protected route
    if (!session && !publicRoutes.includes(pathWithoutLocale)) {
      const loginUrl = new URL(`/${currentLocale}/auth/login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // If authenticated and trying to access auth pages
    if (session && publicRoutes.includes(pathWithoutLocale)) {
      return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
    }

    // Role-based route protection
    if (session?.user?.role) {
      const userRole = session.user.role;

      // SuperAdmin routes (SaaS mode only)
      if (pathWithoutLocale.startsWith('/superadmin')) {
        if (!isSaaSMode || userRole !== 'SUPERADMIN') {
          return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
        }
      }

      // Admin routes
      if (pathWithoutLocale.startsWith('/dashboard/admin')) {
        if (!['ADMIN', 'SUPERADMIN'].includes(userRole)) {
          return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
        }
      }

      // Teacher routes
      if (pathWithoutLocale.startsWith('/dashboard/teacher')) {
        if (!['TEACHER', 'ADMIN', 'SUPERADMIN'].includes(userRole)) {
          return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
        }
      }

      // Student routes
      if (pathWithoutLocale.startsWith('/dashboard/student')) {
        if (!['STUDENT', 'ADMIN', 'SUPERADMIN'].includes(userRole)) {
          return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
        }
      }

      // Parent routes
      if (pathWithoutLocale.startsWith('/dashboard/parent')) {
        if (!['PARENT', 'ADMIN', 'SUPERADMIN'].includes(userRole)) {
          return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
        }
      }
    }

    return null; // Continue processing
  } catch (error) {
    console.error('Auth middleware error:', error);
    // On error, redirect to login only if not on a public route
    if (!publicRoutes.includes(pathWithoutLocale)) {
      return NextResponse.redirect(new URL(`/${currentLocale}/auth/login`, request.url));
    }
    return null;
  }
}
