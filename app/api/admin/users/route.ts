export const runtime = 'nodejs';
/**
 * Admin user management.
 *
 *   GET  /api/admin/users            → list all users (admin only)
 *   POST /api/admin/users            → { id, action: 'approve'|'reject' }
 *
 * Only an approved admin (resolved from the DB, not the token) may use these.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

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
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Provide a user id and action (approve|reject).' }, { status: 400 });
  }

  // Guard: admin can't reject/lock themselves out.
  if (id === admin.id) {
    return NextResponse.json({ error: 'You cannot change your own account.' }, { status: 400 });
  }

  const status = action === 'approve' ? 'approved' : 'rejected';
  await sql`UPDATE users SET status = ${status} WHERE id = ${id}`;
  return NextResponse.json({ ok: true, id, status });
}