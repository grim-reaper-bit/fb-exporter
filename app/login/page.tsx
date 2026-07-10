'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoginBackground from '../LoginBackground';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  // Surface verification outcomes redirected from /api/auth/verify.
  useEffect(() => {
    const v = params.get('verify');
    if (v === 'success') setMsg({ t: 'Email verified — you can sign in now.', ok: true });
    else if (v === 'expired') setMsg({ t: 'That link expired. Register again to get a new one.', ok: false });
    else if (v === 'invalid') setMsg({ t: 'That verification link is invalid.', ok: false });
    else if (v === 'error') setMsg({ t: 'Verification failed. Try again.', ok: false });
  }, [params]);

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
        <input id="pw" ref={pwRef} type="password" autoComplete="current-password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.ok ? '✓ ' : '× '}{msg.t}</p>}

        <div className="switch">No account yet? <Link href="/register">Create one</Link></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <LoginBackground />
      <Suspense fallback={<div className="authwrap"><div className="authbox"><p className="sub">Loading…</p></div></div>}>
        <LoginInner />
      </Suspense>
    </>
  );
}