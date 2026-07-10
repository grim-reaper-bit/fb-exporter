/**
 * middleware.ts — route protection with live revocation + idle timeout.
 *
 * On every request to a protected route:
 *   1. Verify the session JWT signature (edge-safe via jose).
 *   2. Look up the user's CURRENT status in the database. If they are no longer
 *      'approved' (e.g. the admin rejected them), they are logged out at once —
 *      even if their token hasn't expired. This closes the "rejected user keeps
 *      access until the token expires" hole.
 *   3. Re-issue a fresh token (sliding idle window): an active user stays logged
 *      in; an idle user's token expires after IDLE_TIMEOUT_SEC and they must
 *      sign in again.
 *
 * Neon runs over HTTP(S) fetch, so it works in the Edge runtime used here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { readSession, createSession, sessionCookie, SESSION_COOKIE } from '@/lib/auth';

async function currentStatus(uid: number): Promise<string | null> {
  try {
    const sql = neon(process.env.DATABASE_URL as string);
    const rows = (await sql`SELECT status FROM users WHERE id = ${uid}`) as { status: string }[];
    return rows[0]?.status ?? null;
  } catch {
    // If the DB check fails, fail safe: treat as not-approved (redirect to login).
    return null;
  }
}

function toLogin(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.set(sessionCookie('', 0));
  return res;
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return toLogin(req);

  const status = await currentStatus(session.uid);
  if (status !== 'approved') return toLogin(req);

  const res = NextResponse.next();
  const fresh = await createSession(session.uid, session.email);
  res.cookies.set(sessionCookie(fresh));
  return res;
}

export const config = {
  matcher: ['/', '/reddit', '/youtube', '/admin'],
};