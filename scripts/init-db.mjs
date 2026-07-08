/**
 * scripts/init-db.mjs — one-time schema setup.
 *
 * Creates the `users` table on your Neon database. Run once after setting
 * DATABASE_URL:
 *
 *   DATABASE_URL="postgres://..." node scripts/init-db.mjs
 *
 * Safe to re-run: uses IF NOT EXISTS.
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local (or .env) ourselves — plain Node doesn't read them like
// Next.js does. We parse the file for KEY="value" lines and set process.env.
function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  for (const name of ['.env.local', '.env']) {
    try {
      const text = readFileSync(join(root, name), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        let val = m[2].trim();
        // strip surrounding single or double quotes
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[m[1]]) process.env[m[1]] = val;
      }
    } catch { /* file not present — that's fine */ }
  }
}
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  console.error('Add it to .env.local as:  DATABASE_URL="postgresql://...neon.tech/db?sslmode=require"');
  console.error('Or pass it inline:  $env:DATABASE_URL="..."; node scripts/init-db.mjs');
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    email          TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    verified       BOOLEAN NOT NULL DEFAULT false,
    verify_token   TEXT,
    verify_expires TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users (verify_token)`,
];

try {
  for (const stmt of statements) {
    if (typeof sql.query === 'function') {
      // Preferred: run a raw SQL string.
      await sql.query(stmt);
    } else {
      // Older client without .query(): use the raw tagged-template form.
      // These DDL strings contain no user input, so building a template
      // literal with an empty values array is safe here.
      await sql([stmt], []);
    }
  }
  console.log('\u2713 users table ready.');
  process.exit(0);
} catch (e) {
  console.error('DB init failed:', e && e.message ? e.message : e);
  console.error('\nIf this says "sql.query is not a function", update the client:');
  console.error('  npm install @neondatabase/serverless@latest');
  process.exit(1);
}
