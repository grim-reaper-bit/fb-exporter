'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import PasswordField from '../PasswordField';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const inviteRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, invite }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setMsg({ t: data.message || 'Account created. You can sign in now.', ok: true });
      } else {
        setMsg({ t: data.error || 'Registration failed.', ok: false });
      }
    } catch {
      setMsg({ t: 'Network error. Try again.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authwrap">
      <div className="authbox">
        <div className="badge"><span className="dot" />Create account</div>
        <h1>Register</h1>
        <p className="sub">Enter the invite code and your details to create an account.</p>

        {!done && (
          <>
            <label htmlFor="em">Email</label>
            <input id="em" type="email" autoComplete="username" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pwRef.current?.focus()} />
            <label htmlFor="pw">Password</label>
            <PasswordField id="pw" ref={pwRef} autoComplete="new-password" placeholder="at least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inviteRef.current?.focus()} />
            <label htmlFor="inv">Invite code</label>
            <input id="inv" ref={inviteRef} type="text" autoComplete="off" placeholder="code from the site owner"
              value={invite} onChange={(e) => setInvite(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button className="primary" onClick={submit} disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </>
        )}

        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.ok ? '✓ ' : '× '}{msg.t}</p>}

        {done ? (
          <div className="authnote">
            Your account <b style={{ color: 'var(--paper)' }}>{email}</b> is ready.
            You can <Link href="/login">sign in</Link> now.
          </div>
        ) : (
          <div className="switch">Already have an account? <Link href="/login">Sign in</Link></div>
        )}
      </div>
    </div>
  );
}