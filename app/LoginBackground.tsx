'use client';
/**
 * LoginBackground.tsx — animated 3D NET background (Vanta.js) for auth pages.
 *
 * Glowing amber network nodes/lines in navy 3D space that react to the mouse.
 * Matches the site brand. Vanta + its required Three.js build (r134) are loaded
 * from CDN on demand; if they can't load (offline / blocked), the CSS navy
 * background shows instead — the page still works.
 */
import { useEffect, useRef } from 'react';

// Vanta attaches to window; type it loosely since it's a runtime global.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { VANTA?: any; THREE?: any; }
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Avoid double-injecting the same script.
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export default function LoginBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const effectRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Vanta requires this specific Three.js build.
      const okThree = await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js');
      if (!okThree || cancelled) return;
      const okVanta = await loadScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.net.min.js');
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