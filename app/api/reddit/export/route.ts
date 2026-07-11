export const runtime = 'nodejs';
/**
 * POST /api/reddit/export
 * Body: { url: string }
 *
 * Fetches a public Reddit thread's comments via Reddit's own `.json` endpoint
 * (no API key required for public content), flattens the nested comment tree
 * into rows, and returns them as structured JSON. The client turns this into a
 * CSV or JSON download.
 *
 * Why the `.json` endpoint and not the official OAuth API: as of 2026 Reddit's
 * official Data API requires approved access (self-service registration closed
 * in late 2025). The per-URL `.json` endpoint remains open, needs no auth for
 * public content, and returns the same structured data Reddit's own clients use.
 *
 * Known limitation (confirmed by direct testing, not theoretical): Reddit's
 * anti-bot layer can 403 this even with a correct, realistic User-Agent header.
 * It isn't just checking the UA string — it fingerprints the actual TLS
 * handshake (JA3/JA4: cipher order, extensions, etc.), which a server-side
 * `fetch()` can never make byte-identical to a real Chrome browser's, no
 * matter what headers are set. A client-side fetch from the browser doesn't
 * work around it either — the same endpoint refuses cross-origin script
 * access (CORS), confirmed by testing a real Chromium fetch from this site's
 * own origin (`net::ERR_FAILED`, no CORS headers on the response). Opening
 * the `.json` URL directly in a browser tab (top-level navigation, not
 * subject to CORS) does work — that's the fastest way to tell "Reddit is
 * currently blocking requests like ours" from "something else is wrong."
 * A durable fix would mean fetching through a real headless browser
 * server-side, which trades this route's current speed and simplicity for
 * meaningfully heavier, slower, more fragile infrastructure — not worth it
 * unless 403s become the common case rather than the occasional one.
 *
 * This route is protected: only logged-in users reach it (see middleware).
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

// Columns mirror the Facebook comment-exporter tool, so both platforms share
// one data model. Reddit has no numeric author id, so account_id carries
// Reddit's stable author fullname (t2_xxxx) instead.
export interface RedditRow {
  post_url: string;
  post_id: string;
  post_author: string;
  exported_at: string;
  account_id: string;      // Reddit author fullname (t2_...)
  comment_id: string;      // t1_...
  parent_comment_id: string;
  depth: number;
  isReply: boolean;
  author: string;
  profileUrl: string;
  text: string;
  createdTime: string;     // ISO 8601
  likes: number;           // score
  replyCount: number;
}

// Reddit thread URLs look like:
//   https://www.reddit.com/r/<sub>/comments/<id>/<slug>/
// We accept full URLs (with or without trailing slash, query, or www/old/new).
// Validate a full Reddit thread URL (with /comments/) and turn it into its
// .json form. Returns null if it isn't a Reddit comments permalink.
//
// Note: Reddit share links (/r/<sub>/s/<code>) are intentionally NOT accepted.
// They HTTP-redirect to the real thread only for browsers; Reddit returns 403
// to server-side clients trying to resolve them. So we ask the user to paste
// the full /comments/ URL, which the browser shows once the thread is open.
function normalizeThreadUrl(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  // Allow pasting without protocol.
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

  let u: URL;
  try { u = new URL(raw); } catch { return null; }

  if (!/(^|\.)reddit\.com$/i.test(u.hostname)) return null;
  // Must be a comments/thread permalink.
  if (!/\/comments\/[a-z0-9]+/i.test(u.pathname)) return null;

  // Rebuild a clean canonical URL on www.reddit.com, drop query/fragment.
  const path = u.pathname.replace(/\/+$/, '');
  return `https://www.reddit.com${path}.json`;
}

interface RedditCommentData {
  id?: string;
  name?: string;
  parent_id?: string;
  author?: string;
  author_fullname?: string;
  body?: string;
  score?: number;
  created_utc?: number;
  depth?: number;
  replies?: RedditListing | '' | null;
}
interface RedditChild { kind: string; data: RedditCommentData; }
interface RedditListing { data?: { children?: RedditChild[] }; }

// Recursively flatten the comment tree into rows, preserving depth and parent.
function flatten(
  children: RedditChild[] | undefined,
  ctx: { post_url: string; post_id: string; post_author: string; exported_at: string },
  depth: number,
  out: RedditRow[]
): void {
  if (!children) return;
  for (const child of children) {
    // Skip "more comments" stubs and anything that isn't a real comment (t1).
    if (child.kind !== 't1') continue;
    const d = child.data;

    const replies = d.replies && typeof d.replies === 'object' ? d.replies : null;
    const replyChildren = replies?.data?.children?.filter((c) => c.kind === 't1') ?? [];

    const author = d.author && d.author !== '[deleted]' ? d.author : (d.author || '[deleted]');

    out.push({
      post_url: ctx.post_url,
      post_id: ctx.post_id,
      post_author: ctx.post_author,
      exported_at: ctx.exported_at,
      account_id: d.author_fullname || '',
      comment_id: d.name || (d.id ? `t1_${d.id}` : ''),
      parent_comment_id: d.parent_id || '',
      depth,
      isReply: depth > 0,
      author,
      profileUrl: author && author !== '[deleted]' ? `https://www.reddit.com/u/${author}` : '',
      text: d.body || '',
      createdTime: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : '',
      likes: typeof d.score === 'number' ? d.score : 0,
      replyCount: replyChildren.length,
    });

    // Recurse into nested replies.
    if (replyChildren.length) flatten(replyChildren, ctx, depth + 1, out);
  }
}

export async function POST(req: NextRequest) {
  // Gate: require a valid session.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const jsonUrl = normalizeThreadUrl(body.url || '');
  if (!jsonUrl) {
    return NextResponse.json(
      { error: 'Paste the full thread URL containing /comments/. Reddit share links (/s/…) don\'t work — open the thread first, then copy the URL from the address bar.' },
      { status: 400 }
    );
  }

  // Fetch the thread. `raw_json=1` keeps Reddit from HTML-escaping the text.
  // The User-Agent below is necessary but not sufficient — see the module
  // comment above for why this can still 403 regardless.
  const fetchUrl = `${jsonUrl}?raw_json=1&limit=500`;
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError'
      ? 'Reddit took too long to respond. Try again in a moment.'
      : 'Could not reach Reddit. Try again in a moment.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (res.status === 429) {
    return NextResponse.json(
      { error: 'Reddit rate-limited this request. Wait a few minutes and try again.' },
      { status: 429 }
    );
  }
  if (res.status === 403) {
    return NextResponse.json(
      {
        error: 'Reddit blocked this request (403) — its anti-bot layer occasionally rejects server-side requests even with a valid browser User-Agent. ' +
          `To check if it's just Reddit being temperamental right now: paste ${fetchUrl} straight into your browser's address bar. ` +
          'If that loads JSON fine, wait a few minutes and retry here. If it also fails in the browser, the thread or your connection is the issue, not this tool.',
      },
      { status: 403 }
    );
  }
  if (res.status === 404) {
    return NextResponse.json(
      { error: 'Thread not found (404). Double-check the URL, or the thread may have been removed.' },
      { status: 404 }
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Reddit returned an error (${res.status}).` }, { status: 502 });
  }

  let data: unknown;
  try { data = await res.json(); } catch { return NextResponse.json({ error: 'Reddit returned an unexpected response.' }, { status: 502 }); }

  // A thread .json is a 2-element array: [postListing, commentListing].
  if (!Array.isArray(data) || data.length < 2) {
    return NextResponse.json({ error: 'Unexpected thread format from Reddit.' }, { status: 502 });
  }

  const postListing = data[0] as RedditListing;
  const commentListing = data[1] as RedditListing;
  const post = postListing?.data?.children?.[0]?.data as
    | (RedditCommentData & { title?: string; permalink?: string; num_comments?: number })
    | undefined;

  if (!post) {
    return NextResponse.json({ error: 'Could not read the thread post.' }, { status: 502 });
  }

  const exported_at = new Date().toISOString();
  const ctx = {
    post_url: post.permalink ? `https://www.reddit.com${post.permalink}` : (body.url || ''),
    post_id: post.name || '',
    post_author: post.author || '[deleted]',
    exported_at,
  };

  const rows: RedditRow[] = [];
  flatten(commentListing?.data?.children, ctx, 0, rows);

  // "more comments" collapse: if Reddit hid replies behind a "more" stub, we
  // captured what was returned but can't see the rest without extra calls. We
  // report the post's declared num_comments so the user can spot a shortfall.
  const declared = typeof post.num_comments === 'number' ? post.num_comments : null;

  return NextResponse.json({
    rows,
    meta: {
      post_title: post.title || '',
      post_author: ctx.post_author,
      post_url: ctx.post_url,
      captured: rows.length,
      declared_comments: declared,
      complete: declared == null ? null : rows.length >= declared,
      exported_at,
    },
  });
}