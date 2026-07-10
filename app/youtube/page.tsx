'use client';
/**
 * app/youtube/page.tsx — YouTube video comment exporter.
 *
 * A logged-in user pastes a YouTube video URL; the server pulls all comments and
 * replies via the official YouTube Data API v3 and returns rows matching the
 * Facebook tool's schema. The user downloads CSV or JSON.
 *
 * Protected by middleware (matcher includes /youtube) AND the API route's own
 * session check.
 */
import { useState, useRef } from 'react';
import Link from 'next/link';

interface Row {
  post_url: string; post_id: string; post_author: string; exported_at: string;
  account_id: string; comment_id: string; parent_comment_id: string;
  depth: number; isReply: boolean; author: string; profileUrl: string;
  text: string; createdTime: string; likes: number; replyCount: number;
}
interface Meta {
  video_id: string; post_author: string; post_url: string;
  captured: number; exported_at: string; partial: boolean; note?: string;
}

const COLUMNS: (keyof Row)[] = [
  'post_url', 'post_id', 'post_author', 'exported_at',
  'account_id', 'comment_id', 'parent_comment_id', 'depth', 'isReply',
  'author', 'profileUrl', 'text', 'createdTime', 'likes', 'replyCount',
];

function toCSV(rows: Row[]): string {
  const esc = (v: unknown) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '\uFEFF' + COLUMNS.join(',') + '\r\n' +
    rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(',')).join('\r\n');
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function YouTubePage() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run() {
    setBusy(true); setMsg(null); setRows(null); setMeta(null);
    try {
      const res = await fetch('/api/youtube/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ t: data.error || 'Export failed.', ok: false });
      } else {
        setRows(data.rows);
        setMeta(data.meta);
        setMsg({ t: `Captured ${data.rows.length} comments.`, ok: true });
      }
    } catch {
      setMsg({ t: 'Network error. Try again.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return (
    <div className="rwrap">
      <header className="rtop">
        <div className="badge"><span className="dot" />YouTube exporter</div>
        <Link href="/" className="rback">← back to overview</Link>
      </header>

      <h1>Export YouTube comments</h1>
      <p className="rsub">
        Paste a YouTube video URL. Comments and replies are pulled through the
        official YouTube Data API and returned in the same schema as the Facebook
        exporter — download as CSV or JSON.
      </p>

      <div className="rcard">
        <label htmlFor="yurl">Video URL</label>
        <input
          id="yurl"
          ref={inputRef}
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && url && run()}
        />
        <button className="primary" onClick={run} disabled={busy || !url}>
          {busy ? 'Fetching…' : 'Fetch comments'}
        </button>

        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.ok ? '✓ ' : '× '}{msg.t}</p>}
        <p className="rtip">
          Works with <code>watch?v=</code>, <code>youtu.be</code>, and <code>/shorts/</code> links.
          Pulls every comment plus full reply threads.
        </p>
      </div>

      {rows && meta && (
        <div className="rcard rresult">
          <div className="rmeta">
            <div className="rmrow"><span>Channel</span><b>{meta.post_author || '(unknown)'}</b></div>
            <div className="rmrow"><span>Video</span><b>{meta.video_id}</b></div>
            <div className="rmrow"><span>Comments captured</span><b>{meta.captured}</b></div>
          </div>

          {meta.partial && (
            <p className="msg warn">⚠ {meta.note || 'Some replies could not be fetched. The data below is what was retrieved.'}</p>
          )}

          <div className="rdl">
            <button className="secondary" onClick={() => download(`youtube-comments-${stamp()}.csv`, toCSV(rows), 'text/csv')}>
              Download CSV
            </button>
            <button className="secondary" onClick={() => download(`youtube-comments-${stamp()}.json`, JSON.stringify(rows, null, 2), 'application/json')}>
              Download JSON
            </button>
          </div>
        </div>
      )}

      <p className="rnote">
        Uses the official YouTube Data API v3 — legitimate, ToS-compliant, no
        scraping. The daily API quota is generous but finite; if you see a quota
        notice, it resets at midnight Pacific time.
      </p>
    </div>
  );
}