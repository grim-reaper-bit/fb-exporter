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
 * Reuses the same lazily-cached client as lib/db.ts instead of opening a new
 * one per request.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { readSession, createSession, sessionCookie, SESSION_COOKIE } from '@/lib/auth';

type StatusLookup = { reachable: true; status: string | null } | { reachable: false };

async function currentStatus(uid: number): Promise<StatusLookup> {
  try {
    const rows = (await sql`SELECT status FROM users WHERE id = ${uid}`) as { status: string }[];
    return { reachable: true, status: rows[0]?.status ?? null };
  } catch (e) {
    console.error('[middleware] status lookup failed', e);
    return { reachable: false };
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

  const lookup = await currentStatus(session.uid);

  if (!lookup.reachable) {
    // DB is unreachable (transient Neon blip, cold start, etc). Don't punish
    // a valid, unexpired session for an infra hiccup that has nothing to do
    // with whether the account is still approved — let this one request
    // through on the existing token without refreshing it. The live-
    // revocation check simply resumes on the next request once the DB
    // answers again.
    return NextResponse.next();
  }

  if (lookup.status !== 'approved') return toLogin(req);

  const res = NextResponse.next();
  const fresh = await createSession(session.uid, session.email);
  res.cookies.set(sessionCookie(fresh));
  return res;
}

export const config = {
  matcher: ['/', '/reddit', '/youtube', '/admin'],
};