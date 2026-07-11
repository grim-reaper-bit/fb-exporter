/**
 * lib/password.ts — bcrypt password hashing (Node runtime only).
 *
 * Kept SEPARATE from lib/auth.ts because bcryptjs uses Node APIs that the Edge
 * Runtime (used by middleware) rejects. Only API routes — which run on the Node
 * runtime — import this. Middleware imports lib/auth.ts (jose only), never this.
 */
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Charset excludes visually ambiguous characters (0/O, 1/l/I) since an admin
// reads this off-screen and relays it to the user out-of-band.
const TEMP_PW_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** A random, human-typable temporary password (~85 bits of entropy at length 14). */
export function generateTempPassword(length = 14): string {
  let out = '';
  for (let i = 0; i < length; i++) out += TEMP_PW_CHARS[randomInt(TEMP_PW_CHARS.length)];
  return out;
}
