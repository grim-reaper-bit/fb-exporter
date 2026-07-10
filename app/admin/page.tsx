import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { sql } from '@/lib/db';
import AdminUserList from './AdminUserList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UserRow {
  id: number;
  email: string;
  status: string;
  is_admin: boolean;
  created_at: string;
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/'); // non-admins never see this page

  const users = (await sql`
    SELECT id, email, status, is_admin, created_at
    FROM users
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      created_at DESC
  `) as UserRow[];

  const pending = users.filter((u) => u.status === 'pending').length;

  return (
    <div className="rwrap">
      <header className="rtop">
        <div className="badge"><span className="dot" />Admin</div>
        <Link href="/" className="rback">← back to overview</Link>
      </header>

      <h1>User management</h1>
      <p className="rsub">
        Signed in as <b style={{ color: 'var(--paper)' }}>{admin.email}</b>.
        {pending > 0
          ? ` ${pending} account${pending === 1 ? '' : 's'} awaiting approval.`
          : ' No accounts awaiting approval.'}
      </p>

      <AdminUserList
        initialUsers={users}
        adminId={admin.id}
      />
    </div>
  );
}