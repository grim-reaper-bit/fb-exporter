'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyInner() {
  const params = useSearchParams();
  useEffect(() => {
    const token = params.get('token');
    // Hand the token to the API route, which validates and redirects to /login.
    window.location.href = `/api/auth/verify?token=${encodeURIComponent(token || '')}`;
  }, [params]);

  return (
    <div className="authwrap">
      <div className="authbox">
        <div className="badge"><span className="dot" />Verifying</div>
        <h1>Confirming your email…</h1>
        <p className="sub">One moment — you'll be redirected to sign in.</p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="authwrap"><div className="authbox"><p className="sub">Loading…</p></div></div>}>
      <VerifyInner />
    </Suspense>
  );
}
