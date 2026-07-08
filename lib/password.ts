/**
 * lib/password.ts — bcrypt password hashing (Node runtime only).
 *
 * Kept SEPARATE from lib/auth.ts because bcryptjs uses Node APIs that the Edge
 * Runtime (used by middleware) rejects. Only API routes — which run on the Node
 * runtime — import this. Middleware imports lib/auth.ts (jose only), never this.
 */
import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
