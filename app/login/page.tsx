'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoginBackground from '../LoginBackground';
import PasswordField from '../PasswordField';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setMsg({ t: data.error || 'Login failed.', ok: false });
      }
    } catch {
      setMsg({ t: 'Network error. Try again.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <LoginBackground />
      <div className="authwrap">
        <div className="authbox">
          <div className="badge"><span className="dot" />Private access</div>
          <h1>Sign in</h1>
          <p className="sub">Enter your credentials to view the documentation.</p>

          <label htmlFor="em">Email</label>
          <input id="em" type="email" autoComplete="username" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pwRef.current?.focus()} />
          <label htmlFor="pw">Password</label>
          <PasswordField id="pw" ref={pwRef} autoComplete="current-password" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.ok ? '✓ ' : '× '}{msg.t}</p>}

          <div className="switch">No account yet? <Link href="/register">Create one</Link></div>
        </div>
      </div>
    </>
  );
}