// scripts/migrate-admin.mjs
// Adds the columns needed for the admin approval system to an existing users
// table, without dropping data. Safe to run multiple times.
//
// Run:  node scripts/migrate-admin.mjs

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('== admin migration ==');

// --- Load .env.local so DATABASE_URL is available ---
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
  console.error('ERROR: DATABASE_URL is not set. Make sure you run this from the');
  console.error('website folder and that .env.local contains DATABASE_URL.');
  process.exit(1);
}
console.log('DATABASE_URL is set.');

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);

  const run = async (stmt) => {
    if (typeof sql.query === 'function') return sql.query(stmt);
    return sql([stmt]);
  };

  console.log('Adding status column...');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);

  console.log('Adding is_admin column...');
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`);

  console.log('Checking for an admin...');
  const admins = await run(`SELECT COUNT(*)::int AS n FROM users WHERE is_admin = true`);
  const adminCount = Array.isArray(admins) ? admins[0]?.n : admins?.rows?.[0]?.n;

  if (!adminCount) {
    const promoted = await run(`
      UPDATE users SET is_admin = true, status = 'approved'
      WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)
      RETURNING email
    `);
    const email = Array.isArray(promoted) ? promoted[0]?.email : promoted?.rows?.[0]?.email;
    if (email) console.log('Promoted first account to admin: ' + email);
    else console.log('No accounts exist yet -- the first to register will become admin.');
  } else {
    console.log('Admin already exists (' + adminCount + ').');
  }

  await run(`CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)`);

  console.log('Adding single-admin race-safety index...');
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_admin ON users (is_admin) WHERE is_admin = true`);
  console.log('');
  console.log('OK Migration complete.');
}

main().catch((e) => {
  console.error('');
  console.error('Migration FAILED:', e.message);
  console.error(e);
  process.exit(1);
});
