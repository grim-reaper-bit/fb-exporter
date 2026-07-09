/**
 * middleware.ts — route protection.
 *
 * The showcase at "/" is private. This checks the session cookie on every
 * request to "/" and redirects to /login when it's missing or invalid.
 * Auth pages and API routes are excluded via the matcher.
 *
 * NOTE: we only verify the JWT signature here (edge-safe via jose). We do NOT
 * hit the database in middleware — that keeps it fast and within edge limits.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) {
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protect the showcase root and the Reddit exporter page. Other routes (login,
// register, verify, api, static assets) handle their own access: the api/reddit
// route checks the session internally, and auth pages are meant to be public.
export const config = {
  matcher: ['/', '/reddit'],
};