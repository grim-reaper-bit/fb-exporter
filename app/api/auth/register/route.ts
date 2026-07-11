export const runtime = 'nodejs';
/**
 * POST /api/auth/register
 * Body: { email, password, invite }
 *
 * Invite-code registration with admin approval (no email verification).
 *
 * Flow:
 *   - The invite code must match INVITE_CODE (the access gate).
 *   - The FIRST account ever registered becomes the super admin, auto-approved.
 *   - Every later account is created with status 'pending' and CANNOT log in
 *     until the admin approves it (see the login route + /admin page).
 *
 * Avoids account enumeration: if the email already exists, returns the same
 * generic success response rather than revealing it.
 *
 * Race safety: "am I the first account" is a read-then-write, so two
 * concurrent registrations could both see an empty table. A partial unique
 * index (idx_users_single_admin, see scripts/migrate-admin.mjs) allows at
 * most one is_admin=true row; if our "first account" insert loses that race,
 * Postgres rejects it and we fall back to inserting as a normal pending user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { NeonDbError } from '@neondatabase/serverless';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Throttle invite-code guessing: 5 registrations attempts per minute per IP.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Wait ${rl.retryAfter}s and try again.` },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string; invite?: string };
  try { body = await req.json(); } catch { return bad('Invalid request.'); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const invite = (body.invite || '').trim();

  const expected = process.env.INVITE_CODE;
  if (!expected) {
    console.error('[register] INVITE_CODE is not set on the server');
    return NextResponse.json({ error: 'Registration is not configured. Contact the site owner.' }, { status: 500 });
  }

  if (!EMAIL_RE.test(email)) return bad('Enter a valid email address.');
  if (password.length < 8) return bad('Password must be at least 8 characters.');
  if (invite !== expected) return bad('Invalid invite code. Ask the site owner for the correct code.');

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return ok(false); // no enumeration
    }

    // Is this the very first account? If so, try to become the super admin.
    const countRows = await sql`SELECT COUNT(*)::int AS n FROM users`;
    const isFirst = (countRows[0]?.n ?? 0) === 0;
    const hash = await hashPassword(password);

    if (isFirst) {
      try {
        await sql`
          INSERT INTO users (email, password_hash, status, is_admin)
          VALUES (${email}, ${hash}, 'approved', true)
        `;
        return ok(true);
      } catch (e) {
        // Someone else's request won the race to be first-admin (enforced by
        // idx_users_single_admin) — fall through and register as pending.
        if (!(e instanceof NeonDbError && e.constraint === 'idx_users_single_admin')) throw e;
      }
    }

    await sql`
      INSERT INTO users (email, password_hash, status, is_admin)
      VALUES (${email}, ${hash}, 'pending', false)
    `;
    return ok(false);
  } catch (e) {
    // Concurrent duplicate-email registration racing past the pre-check above.
    if (e instanceof NeonDbError && e.constraint === 'users_email_key') {
      return ok(false); // no enumeration
    }
    console.error('[register] error', e);
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}

// isAdmin=true → the first (admin) account; can sign in right away.
// isAdmin=false → pending; must wait for approval.
const ok = (isAdmin: boolean) =>
  NextResponse.json({
    ok: true,
    admin: isAdmin,
    message: isAdmin
      ? 'Admin account created. You can sign in now.'
      : 'Account created. It needs approval before you can sign in — the site owner will review it.',
  });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });