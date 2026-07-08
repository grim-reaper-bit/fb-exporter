'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setMsg({ t: data.message || 'Check your email to verify your account.', ok: true });
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
        <p className="sub">Sign up to access the Comment Exporter documentation.</p>

        {!done && (
          <>
            <label htmlFor="em">Email</label>
            <input id="em" type="email" autoComplete="username" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pw')?.focus()} />
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="new-password" placeholder="at least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button className="primary" onClick={submit} disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </>
        )}

        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.ok ? '✓ ' : '× '}{msg.t}</p>}

        {done ? (
          <div className="authnote">
            We sent a verification link to <b style={{ color: 'var(--paper)' }}>{email}</b>.
            Click it to activate your account, then <Link href="/login">sign in</Link>.
          </div>
        ) : (
          <div className="switch">Already have an account? <Link href="/login">Sign in</Link></div>
        )}
      </div>
    </div>
  );
}
