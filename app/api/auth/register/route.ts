export const runtime = 'nodejs';
/**
 * POST /api/auth/register
 * Body: { email, password }
 *
 * Creates an unverified account and emails a verification link. Returns 200 even
 * if the email already exists WITHOUT revealing that (prevents account
 * enumeration) — but still re-sends verification if that account is unverified.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { makeToken } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { sendVerifyEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return bad('Invalid request.'); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!EMAIL_RE.test(email)) return bad('Enter a valid email address.');
  if (password.length < 8) return bad('Password must be at least 8 characters.');

  const token = makeToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    const existing = await sql`SELECT id, verified FROM users WHERE email = ${email}`;

    if (existing.length > 0) {
      const u = existing[0];
      if (!u.verified) {
        // Re-issue verification for an unverified account.
        await sql`UPDATE users SET verify_token = ${token}, verify_expires = ${expires} WHERE id = ${u.id}`;
        await sendVerifyEmail(email, token);
      }
      // Same response whether or not it existed — no enumeration.
      return ok();
    }

    const hash = await hashPassword(password);
    await sql`
      INSERT INTO users (email, password_hash, verified, verify_token, verify_expires)
      VALUES (${email}, ${hash}, false, ${token}, ${expires})
    `;
    await sendVerifyEmail(email, token);
    return ok();
  } catch (e) {
    console.error('[register] error', e);
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}

const ok = () =>
  NextResponse.json({ ok: true, message: 'Check your email for a verification link.' });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
