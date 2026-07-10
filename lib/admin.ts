// lib/admin.ts — server-side helper to resolve the current admin user.
// Looks up admin status from the database (not the token) so a revoked admin
// can't keep acting as one with an old session.
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { sql } from '@/lib/db';

export interface AdminUser { id: number; email: string }

/** Returns the admin user for the current session, or null if not an admin. */
export async function requireAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return null;

  const rows = await sql`
    SELECT id, email, is_admin, status FROM users WHERE id = ${session.uid}
  `;
  const u = rows[0];
  if (!u || !u.is_admin || u.status !== 'approved') return null;
  return { id: u.id, email: u.email };
}