'use client';
import { useState } from 'react';

interface UserRow {
  id: number;
  email: string;
  status: string;
  is_admin: boolean;
  created_at: string;
}

export default function AdminUserList({
  initialUsers,
  adminId,
}: {
  initialUsers: UserRow[];
  adminId: number;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(id: number, action: 'approve' | 'reject') {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Action failed.');
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: data.status } : u))
        );
      }
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  const badge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'badge-pending',
      approved: 'badge-approved',
      rejected: 'badge-rejected',
    };
    return <span className={`ustatus ${map[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="rcard">
      {err && <p className="msg err">× {err}</p>}
      <div className="utable">
        <div className="urow uhead">
          <span>Email</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {users.map((u) => (
          <div className="urow" key={u.id}>
            <span className="uemail">
              {u.email}
              {u.is_admin && <span className="uadmin">admin</span>}
            </span>
            <span>{badge(u.status)}</span>
            <span className="uactions">
              {u.id === adminId ? (
                <span className="uself">you</span>
              ) : (
                <>
                  <button
                    className="uapprove"
                    disabled={busyId === u.id || u.status === 'approved'}
                    onClick={() => act(u.id, 'approve')}
                  >
                    {u.status === 'approved' ? 'Approved' : 'Approve'}
                  </button>
                  <button
                    className="ureject"
                    disabled={busyId === u.id || u.status === 'rejected'}
                    onClick={() => act(u.id, 'reject')}
                  >
                    {u.status === 'rejected' ? 'Rejected' : 'Reject'}
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        {users.length === 0 && <div className="urow"><span>No users yet.</span></div>}
      </div>
    </div>
  );
}