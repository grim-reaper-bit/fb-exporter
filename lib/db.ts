/**
 * lib/db.ts — Neon Postgres access layer.
 *
 * Uses @neondatabase/serverless, which speaks to Neon over HTTP and is built
 * for serverless/edge runtimes like Vercel functions (no persistent socket, so
 * it survives the stateless function model). One tagged-template `sql` client is
 * exported and reused across API routes.
 *
 * The connection string lives ONLY in the DATABASE_URL environment variable —
 * never hardcoded. Set it in Vercel project settings and in .env.local locally.
 */
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Lazy Neon client. Creating neon() requires a valid connection string, which
 * isn't present at build time — so we defer creation until the first query at
 * runtime. A Proxy makes `sql` usable as both a tagged template and
 * `sql.query(...)` while staying lazy.
 *
 * DIAGNOSTIC: on first client creation we log the host we're about to hit, so a
 * wrong/duplicate .env value is immediately obvious in the terminal.
 */
let _client: NeonQueryFunction<false, false> | null = null;
function client(): NeonQueryFunction<false, false> {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set.');
    try {
      const host = new URL(url).host;
      console.log(`[db] connecting to Neon host: ${host}`);
    } catch {
      console.log('[db] DATABASE_URL is set but is not a valid URL — check .env.local');
    }
    _client = neon(url);
  }
  return _client;
}

// Callable proxy: forwards tagged-template calls and .query() to the real client.
export const sql: NeonQueryFunction<false, false> = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
  apply(_t, _this, args: unknown[]) {
    // @ts-expect-error tagged-template passthrough
    return client()(...args);
  },
  get(_t, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>;
    return c[prop];
  },
});

/**
 * User row shape as stored. `password_hash` is a bcrypt hash — the plaintext
 * password is never stored or logged. `verified` gates login until the user
 * clicks the emailed verification link.
 */
export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  verified: boolean;
  verify_token: string | null;
  verify_expires: string | null;
  created_at: string;
}
