'use client';
/**
 * LoginBackground.tsx — animated 3D NET background (Vanta.js) for auth pages.
 *
 * Glowing amber network nodes/lines in navy 3D space that react to the mouse.
 * Matches the site brand. Vanta + its required Three.js build are loaded from
 * CDN on demand, pinned to exact versions with a Subresource Integrity hash
 * so a compromised/tampered CDN response is rejected by the browser instead
 * of executing on this pre-auth page. If they can't load (offline / blocked /
 * integrity mismatch), the CSS navy background shows instead — the page
 * still works.
 */
import { useEffect, useRef } from 'react';

// Vanta attaches to window; type it loosely since it's a runtime global.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { VANTA?: any; THREE?: any; }
}

// Pinned, never "@latest" — a version bump on the CDN shouldn't silently
// change what runs on the login page. Hashes generated with:
//   curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A
const SCRIPTS = [
  {
    src: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js',
    integrity: 'sha384-9EQoUIJYrv09/oYhSxnw1VpLcfPw3BM9dE7+D/3wGUPeLLa7F9Z6OAoD+i/M6FK9',
  },
  {
    src: 'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js',
    integrity: 'sha384-L0sjdcIWJ156WmvbxIBHx79j1WrCqANCyw456nl/aPWSYiHNywEU2VIAcbSJeIiX',
  },
] as const;

// Per-src in-flight load promises. Without this, two near-simultaneous callers
// (e.g. React StrictMode's deliberate double-invoke of effects in dev) would
// each see no matching <script> tag yet, both append one, and — worse — a
// caller could find a tag already in the DOM from the OTHER call and resolve
// immediately even though that script hasn't finished executing yet. That
// race is exactly what caused "VANTA Init error: Cannot read properties of
// undefined (reading 'Group')": Vanta ran before window.THREE was fully set.
const scriptPromises = new Map<string, Promise<boolean>>();

function loadScript(src: string, integrity: string, alreadyLoaded: () => boolean): Promise<boolean> {
  if (alreadyLoaded()) return Promise.resolve(true);

  const cached = scriptPromises.get(src);
  if (cached) return cached;

  const promise = new Promise<boolean>((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      scriptPromises.delete(src); // allow a retry later (e.g. transient network blip)
      resolve(false);
    };
    document.head.appendChild(s);
  });
  scriptPromises.set(src, promise);
  return promise;
}

export default function LoginBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const effectRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Vanta requires Three.js loaded first.
      const [three, vanta] = SCRIPTS;
      const okThree = await loadScript(three.src, three.integrity, () => !!window.THREE);
      if (!okThree || cancelled) return;
      const okVanta = await loadScript(vanta.src, vanta.integrity, () => !!window.VANTA);
      if (!okVanta || cancelled || !ref.current || !window.VANTA) return;

      effectRef.current = window.VANTA.NET({
        el: ref.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1.0,
        scaleMobile: 1.0,
        backgroundColor: 0x0b1220, // navy
        color: 0xf5b301,           // amber
        points: 12,
        maxDistance: 24,
        spacing: 16,
        showDots: true,
      });
    })();

    return () => {
      cancelled = true;
      if (effectRef.current) {
        try { effectRef.current.destroy(); } catch { /* noop */ }
        effectRef.current = null;
      }
    };
  }, []);

  return <div ref={ref} className="loginbg" aria-hidden="true" />;
}