// scripts/remove-email-verification.mjs
//
// One-off cleanup: the email-verification subsystem (Resend, verify links,
// verify_token/verify_expires columns) was removed — access is invite-code +
// admin-approval only now. This drops the now-unused columns from an existing
// database and adds the single-admin race-safety index. Safe to run multiple
// times.
//
// Run:  node scripts/remove-email-verification.mjs

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('== remove email verification ==');

try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  console.log('Loaded .env.local');
} catch (e) {
  console.log('Note: could not read .env.local (' + e.message + '). Using existing env.');
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Run this from the website folder.');
  process.exit(1);
}

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const run = async (stmt) => (typeof sql.query === 'function' ? sql.query(stmt) : sql([stmt]));

  console.log('Adding single-admin race-safety index...');
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_admin ON users (is_admin) WHERE is_admin = true`);

  console.log('Dropping idx_users_verify_token...');
  await run(`DROP INDEX IF EXISTS idx_users_verify_token`);

  console.log('Dropping verify_token, verify_expires, verified columns...');
  await run(`ALTER TABLE users DROP COLUMN IF EXISTS verify_token`);
  await run(`ALTER TABLE users DROP COLUMN IF EXISTS verify_expires`);
  await run(`ALTER TABLE users DROP COLUMN IF EXISTS verified`);

  console.log('');
  console.log('OK Cleanup complete.');
}

main().catch((e) => {
  console.error('');
  console.error('Cleanup FAILED:', e.message);
  console.error(e);
  process.exit(1);
});