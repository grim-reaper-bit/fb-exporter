export const runtime = 'nodejs';
/**
 * Admin user management.
 *
 *   GET  /api/admin/users  → list all users (admin only)
 *   POST /api/admin/users  → { id, action: 'approve'|'reject'|'reset-password'|'delete' }
 *
 * Only an approved admin (resolved from the DB, not the token) may use these.
 *
 * 'reset-password' is the site's whole password-recovery story: there's no
 * email sending, so a locked-out user can't self-serve a reset link. Instead
 * an admin generates a fresh temporary password here, hands it to the user
 * out-of-band (however they shared the invite code), and the user signs in
 * with it. The plaintext is returned exactly once in this response and never
 * stored or logged.
 *
 * 'delete' is scoped to rejected accounts only (re-checked server-side, not
 * trusted from the client) — a rejected signup never held real access or
 * activity, so there's nothing worth keeping. Approved/pending accounts must
 * be rejected first before they can be removed, so an admin can't one-click
 * delete someone who's actually using the site.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { generateTempPassword, hashPassword } from '@/lib/password';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const users = await sql`
    SELECT id, email, status, is_admin, created_at
    FROM users
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      created_at DESC
  `;
  return NextResponse.json({ users, adminEmail: admin.email });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  let body: { id?: number; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const id = Number(body.id);
  const action = body.action;
  const validActions = ['approve', 'reject', 'reset-password', 'delete'];
  if (!id || !validActions.includes(action ?? '')) {
    return NextResponse.json({ error: `Provide a user id and action (${validActions.join('|')}).` }, { status: 400 });
  }

  if (action === 'reset-password') {
    const rows = await sql`SELECT id FROM users WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
    return NextResponse.json({ ok: true, id, tempPassword });
  }

  if (action === 'delete') {
    // Explicit guard, not just relying on "an admin can never be rejected":
    // keeps this action safe even if that invariant ever changes elsewhere.
    if (id === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }
    const rows = await sql`SELECT status FROM users WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (rows[0].status !== 'rejected') {
      return NextResponse.json({ error: 'Only rejected accounts can be deleted.' }, { status: 400 });
    }
    await sql`DELETE FROM users WHERE id = ${id}`;
    return NextResponse.json({ ok: true, id, deleted: true });
  }

  // Guard: admin can't reject/lock themselves out.
  if (id === admin.id) {
    return NextResponse.json({ error: 'You cannot change your own account.' }, { status: 400 });
  }

  const status = action === 'approve' ? 'approved' : 'rejected';
  await sql`UPDATE users SET status = ${status} WHERE id = ${id}`;
  return NextResponse.json({ ok: true, id, status });
}