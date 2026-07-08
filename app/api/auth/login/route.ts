export const runtime = 'nodejs';
/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Verifies credentials server-side. Refuses login for unverified accounts.
 * On success, sets a signed httpOnly session cookie. Uses a single generic
 * error for both "no such user" and "wrong password" to avoid leaking which
 * emails are registered.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { createSession, sessionCookie } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return bad('Invalid request.'); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return bad('Email and password are required.');

  try {
    const rows = await sql`
      SELECT id, email, password_hash, verified FROM users WHERE email = ${email}
    `;
    // Generic failure for missing user OR bad password (no enumeration).
    if (rows.length === 0) return bad('Incorrect email or password.');

    const u = rows[0];
    const good = await verifyPassword(password, u.password_hash);
    if (!good) return bad('Incorrect email or password.');

    if (!u.verified) {
      return NextResponse.json(
        { error: 'Please verify your email first. Check your inbox for the link.' },
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
