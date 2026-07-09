'use client';
/**
 * app/reddit/page.tsx — Reddit thread comment exporter.
 *
 * A logged-in user pastes a public Reddit thread URL; the server fetches the
 * thread via Reddit's `.json` endpoint, flattens the comment tree, and returns
 * rows matching the Facebook tool's schema. The user downloads CSV or JSON.
 *
 * Protected by middleware (matcher includes /reddit) AND by the API route's own
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
  post_title: string; post_author: string; post_url: string;
  captured: number; declared_comments: number | null; complete: boolean | null;
  exported_at: string;
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
  const head = COLUMNS.join(',');
  const body = rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(',')).join('\r\n');
  return '\uFEFF' + head + '\r\n' + body;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RedditPage() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    setRows(null);
    setMeta(null);
    try {
      const res = await fetch('/api/reddit/export', {
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
        <div className="badge"><span className="dot" />Reddit exporter</div>
        <Link href="/" className="rback">← back to overview</Link>
      </header>

      <h1>Export a Reddit thread</h1>
      <p className="rsub">
        Paste a public Reddit thread URL. Comments are fetched through Reddit&apos;s
        own public data endpoint and returned in the same schema as the Facebook
        exporter — download as CSV or JSON.
      </p>

      <div className="rcard">
        <label htmlFor="rurl">Thread URL</label>
        <input
          id="rurl"
          ref={inputRef}
          type="url"
          placeholder="https://www.reddit.com/r/…/comments/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && url && run()}
        />
        <button className="primary" onClick={run} disabled={busy || !url}>
          {busy ? 'Fetching…' : 'Fetch comments'}
        </button>

        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.ok ? '✓ ' : '× '}{msg.t}</p>}
      </div>

      {rows && meta && (
        <div className="rcard rresult">
          <div className="rmeta">
            <div className="rmrow"><span>Thread</span><b>{meta.post_title || '(untitled)'}</b></div>
            <div className="rmrow"><span>Posted by</span><b>u/{meta.post_author}</b></div>
            <div className="rmrow"><span>Comments captured</span><b>{meta.captured}</b></div>
            {meta.declared_comments != null && (
              <div className="rmrow">
                <span>Reddit reports</span>
                <b>{meta.declared_comments}</b>
              </div>
            )}
          </div>

          {meta.complete === false && (
            <p className="msg warn">
              ⚠ Reddit reports more comments than were returned in one request.
              Some deeply nested or collapsed replies may be behind &quot;load more&quot;
              stubs. What you have is complete for the branches Reddit returned.
            </p>
          )}

          <div className="rdl">
            <button className="secondary" onClick={() => download(`reddit-comments-${stamp()}.csv`, toCSV(rows), 'text/csv')}>
              Download CSV
            </button>
            <button className="secondary" onClick={() => download(`reddit-comments-${stamp()}.json`, JSON.stringify(rows, null, 2), 'application/json')}>
              Download JSON
            </button>
          </div>
        </div>
      )}

      <p className="rnote">
        Reads public comments only, via Reddit&apos;s per-URL <code>.json</code> endpoint —
        no login to Reddit, no scraping of private data. Heavy use is rate-limited
        by Reddit; if you see a rate-limit notice, wait a minute and retry.
      </p>
    </div>
  );
}