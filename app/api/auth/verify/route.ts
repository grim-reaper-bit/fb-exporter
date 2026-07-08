export const runtime = 'nodejs';
/**
 * GET /api/auth/verify?token=...
 *
 * Validates a verification token: if it matches an unverified user and hasn't
 * expired, marks the account verified and clears the token. Redirects to
 * /login with a status flag either way (no raw JSON for a link click).
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const base = req.nextUrl.origin;

  if (!token) return NextResponse.redirect(`${base}/login?verify=invalid`);

  try {
    const rows = await sql`
      SELECT id, verify_expires FROM users
      WHERE verify_token = ${token} AND verified = false
    `;
    if (rows.length === 0) {
      return NextResponse.redirect(`${base}/login?verify=invalid`);
    }
    const u = rows[0];
    if (u.verify_expires && new Date(u.verify_expires).getTime() < Date.now()) {
      return NextResponse.redirect(`${base}/login?verify=expired`);
    }
    await sql`
      UPDATE users SET verified = true, verify_token = null, verify_expires = null
      WHERE id = ${u.id}
    `;
    return NextResponse.redirect(`${base}/login?verify=success`);
  } catch (e) {
    console.error('[verify] error', e);
    return NextResponse.redirect(`${base}/login?verify=error`);
  }
}
