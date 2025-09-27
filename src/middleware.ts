'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { getSessionOptions, type SessionData } from '@/lib/session';

// Define the paths that are protected and require authentication.
const protectedPaths = [
  '/dashboard',
  '/raid-pile',
  '/raid-train',
  '/community-pool',
  '/vip-live',
  '/community-spotlight',
  '/calendar',
  '/team-chat',
  '/analytics',
  '/settings',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the requested path is one of the protected routes.
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    try {
      const sessionOptions = await getSessionOptions();
      const session = await getIronSession<SessionData>(request.cookies, sessionOptions);

      // If the user is not logged in, redirect them to the homepage.
      if (!session.isLoggedIn || !session.adminId) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (error) {
      console.error('Middleware session error:', error);
      // If there's an error reading the session, it's safer to redirect to login.
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // If the path is not protected or the user is authenticated, continue.
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - join (public join page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|join).*)',
  ],
};
