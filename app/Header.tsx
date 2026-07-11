'use client';
import { useEffect, useRef, useState } from 'react';
import LogoutButton from './LogoutButton';

const LINKS = [
  { href: '#what', label: 'Overview' },
  { href: '#features', label: 'Features' },
  { href: '#output', label: 'Output' },
  { href: '#shots', label: 'Screenshots' },
  { href: '#install', label: 'Install' },
  { href: '/reddit', label: 'Reddit tool' },
  { href: '/youtube', label: 'YouTube tool' },
];

export default function Header({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const headerRef = useRef<HTMLElement>(null);

  // Close the mobile dropdown on outside click, Escape, or lock body scroll
  // while it's open — standard dropdown behavior the toggle alone doesn't give.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <header className="bar" ref={headerRef}>
      <div className="wrap">
        <div className="brand"><span className="sig" />Comment Exporter</div>

        <button
          type="button"
          className="navtoggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>

        <div className={`navwrap${open ? ' open' : ''}`}>
          <nav className="top">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
            ))}
            {isAdmin && <a href="/admin" onClick={close}>Admin</a>}
            <a
              href="https://github.com/grim-reaper-bit/FB-comment-exporter"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-gh"
              aria-label="View source on GitHub"
              onClick={close}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="15" height="15" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px', marginTop: '-2px' }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </nav>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}