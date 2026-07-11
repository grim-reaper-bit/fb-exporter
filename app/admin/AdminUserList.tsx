'use client';
import { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';

interface UserRow {
  id: number;
  email: string;
  status: string;
  is_admin: boolean;
  created_at: string;
}

type PendingAction =
  | { kind: 'reset-password'; id: number; email: string }
  | { kind: 'delete'; id: number; email: string };

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
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

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

  async function doResetPassword(id: number, email: string) {
    setBusyId(id);
    setErr(null);
    setCopied(false);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reset-password' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Reset failed.');
      } else {
        setReveal({ email, password: data.tempPassword });
      }
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function doDeleteUser(id: number) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Delete failed.');
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  function confirmPending() {
    if (!pending) return;
    const { kind, id, email } = pending;
    setPending(null);
    if (kind === 'reset-password') doResetPassword(id, email);
    else doDeleteUser(id);
  }

  async function copyPassword() {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.password);
      setCopied(true);
    } catch {
      setCopied(false);
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

      {reveal && (
        <div className="resetreveal">
          <div className="rrhead">
            <span>New password for <b>{reveal.email}</b> — copy it now, it won&apos;t be shown again</span>
            <button className="rrclose" onClick={() => setReveal(null)} aria-label="Dismiss">×</button>
          </div>
          <div className="rrbody">
            <code>{reveal.password}</code>
            <button className="secondary" onClick={copyPassword}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
          <p className="rrnote">Send this to {reveal.email} out-of-band (however you shared the invite code). Their old password no longer works.</p>
        </div>
      )}

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
              {u.id === adminId && <span className="uself">you</span>}
              {u.id !== adminId && (
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
              <button
                className="ureset"
                disabled={busyId === u.id}
                onClick={() => setPending({ kind: 'reset-password', id: u.id, email: u.email })}
              >
                Reset password
              </button>
              {u.id !== adminId && u.status === 'rejected' && (
                <button
                  className="udelete"
                  disabled={busyId === u.id}
                  onClick={() => setPending({ kind: 'delete', id: u.id, email: u.email })}
                >
                  Delete
                </button>
              )}
            </span>
          </div>
        ))}
        {users.length === 0 && <div className="urow"><span>No users yet.</span></div>}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'delete' ? 'Delete this account?' : 'Reset password?'}
        body={
          pending?.kind === 'delete'
            ? `Permanently delete the rejected account ${pending.email}? This cannot be undone.`
            : `Reset the password for ${pending?.email}? Their current password will stop working immediately.`
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete' : 'Reset password'}
        tone={pending?.kind === 'delete' ? 'danger' : 'default'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}