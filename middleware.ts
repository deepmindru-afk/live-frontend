import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const blockedRoutes = [
  '/login',
  '/signup',
  '/admin',
  '/admin/',
  '/admin/index',
  '/instructor/login',
  '/instructor/signup',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isBlocked = blockedRoutes.some((route) => {
    if (route.endsWith('/')) {
      return pathname === route.slice(0, -1) || pathname.startsWith(route);
    }
    if (route === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/');
    }
    return pathname === route;
  });

  if (isBlocked) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/signup',
    '/admin/:path*',
    '/instructor/login',
    '/instructor/signup',
  ],
};


