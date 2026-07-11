export const runtime = 'nodejs';
/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Verifies credentials server-side. Refuses login for accounts that aren't
 * yet approved by an admin (or were rejected). On success, sets a signed
 * httpOnly session cookie. Uses a single generic
 * error for both "no such user" and "wrong password" to avoid leaking which
 * emails are registered.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { createSession, sessionCookie } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  // Throttle brute-force: 10 attempts per minute per IP.
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Wait ${rl.retryAfter}s and try again.` },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return bad('Invalid request.'); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return bad('Email and password are required.');

  try {
    const rows = await sql`
      SELECT id, email, password_hash, status FROM users WHERE email = ${email}
    `;
    // Generic failure for missing user OR bad password (no enumeration).
    if (rows.length === 0) return bad('Incorrect email or password.');

    const u = rows[0];
    const good = await verifyPassword(password, u.password_hash);
    if (!good) return bad('Incorrect email or password.');

    // Approval gate: only 'approved' accounts may sign in.
    if (u.status === 'pending') {
      return NextResponse.json(
        { error: 'Your account is awaiting approval by the site owner. Try again once approved.' },
        { status: 403 }
      );
    }
    if (u.status === 'rejected') {
      return NextResponse.json(
        { error: 'This account was not approved for access.' },
        { status: 403 }
      );
    }

    const token = await createSession(u.id, u.email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (e) {
    console.error('[login] error', e);
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });