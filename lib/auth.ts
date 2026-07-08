/**
 * lib/auth.ts — edge-safe session primitives (jose + node:crypto only).
 *
 * - Sessions are stateless: a signed JWT in an httpOnly cookie. The signing
 *   secret lives in AUTH_SECRET (env only). httpOnly means page JavaScript can't
 *   read the cookie, so an XSS bug can't trivially steal the session.
 * - Verification tokens are random 32-byte hex strings.
 *
 * Password hashing lives in lib/password.ts (bcrypt, Node-only) so this module
 * stays importable from Edge middleware.
 */
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

// AUTH_SECRET signs every session token. In production it MUST be set to a real
// random value — otherwise sessions could be forged with the known dev fallback.
// We refuse to start in production without it, rather than run silently insecure.
const RAW_SECRET = process.env.AUTH_SECRET;
if (!RAW_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'AUTH_SECRET is not set. Set it in your Vercel project environment variables ' +
    '(generate one with: openssl rand -hex 32). Refusing to run insecurely.'
  );
}
const SECRET = new TextEncoder().encode(
  RAW_SECRET || 'dev-only-insecure-secret-change-me'
);
const COOKIE = 'ce_session';
const DAY = 60 * 60 * 24;

/** Random URL-safe token for email verification links. */
export function makeToken(): string {
  return randomBytes(32).toString('hex');
}

/** Create a signed session JWT (7-day expiry) for a verified user. */
export async function createSession(userId: number, email: string): Promise<string> {
  return new SignJWT({ uid: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

/** Verify a session JWT; returns the payload or null if invalid/expired. */
export async function readSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { uid: number; email: string };
  } catch {
    return null;
  }
}

/** Cookie options for the session (httpOnly, secure, lax). */
export function sessionCookie(value: string, maxAgeSec = 7 * DAY) {
  return {
    name: COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}
export const SESSION_COOKIE = COOKIE;
