export const runtime = 'nodejs';
/**
 * POST /api/youtube/export
 * Body: { url: string }   (a YouTube video URL or bare video id)
 *
 * Fetches all comments (and replies) for a public YouTube video using the
 * official YouTube Data API v3, flattens them into rows matching the Facebook
 * exporter's schema, and returns them. The client turns this into CSV or JSON.
 *
 * Why the official API (not scraping): YouTube provides a real, free API for
 * exactly this. It's stable, ToS-compliant, and portfolio-safe. It needs an API
 * key (server-side only, never exposed to the browser).
 *
 * Quota: commentThreads.list and comments.list each cost 1 unit/call; the free
 * tier is 10,000 units/day — thousands of comment pages. Plenty for research.
 *
 * Protected: only logged-in users reach it (middleware + the session check here).
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

const API = 'https://www.googleapis.com/youtube/v3';

// Columns mirror the Facebook comment-exporter tool for a shared data model.
// YouTube has no numeric author id exposed; account_id carries the channel id.
export interface YtRow {
  post_url: string;
  post_id: string;         // video id
  post_author: string;     // channel that owns the video
  exported_at: string;
  account_id: string;      // commenter channel id
  comment_id: string;
  parent_comment_id: string;
  depth: number;
  isReply: boolean;
  author: string;          // commenter display name
  profileUrl: string;      // commenter channel URL
  text: string;
  createdTime: string;     // ISO 8601
  likes: number;
  replyCount: number;
}

// Accept a full YouTube URL (watch, youtu.be, shorts, embed) or a bare 11-char id.
function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare id (YouTube ids are 11 chars of [A-Za-z0-9_-]).
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return null; }

  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    // watch?v=ID
    const v = u.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    // /shorts/ID or /embed/ID or /v/ID
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

interface YtCommentSnippet {
  authorDisplayName?: string;
  authorChannelUrl?: string;
  authorChannelId?: { value?: string };
  textOriginal?: string;
  textDisplay?: string;
  likeCount?: number;
  publishedAt?: string;
  videoId?: string;
  parentId?: string;
}
interface YtComment { id?: string; snippet?: YtCommentSnippet }
interface YtThreadItem {
  id?: string;
  snippet?: {
    topLevelComment?: YtComment;
    totalReplyCount?: number;
    videoId?: string;
  };
  replies?: { comments?: YtComment[] };
}
interface YtListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  error?: { errors?: { reason?: string }[]; message?: string };
}

function rowFromComment(
  c: YtComment,
  ctx: { post_url: string; post_id: string; post_author: string; exported_at: string },
  depth: number,
  parentId: string,
  replyCount: number
): YtRow {
  const s = c.snippet || {};
  return {
    post_url: ctx.post_url,
    post_id: ctx.post_id,
    post_author: ctx.post_author,
    exported_at: ctx.exported_at,
    account_id: s.authorChannelId?.value || '',
    comment_id: c.id || '',
    parent_comment_id: parentId,
    depth,
    isReply: depth > 0,
    author: s.authorDisplayName || '',
    profileUrl: s.authorChannelUrl || '',
    text: s.textOriginal || s.textDisplay || '',
    createdTime: s.publishedAt || '',
    likes: typeof s.likeCount === 'number' ? s.likeCount : 0,
    replyCount,
  };
}

async function ytGet<T>(path: string, params: Record<string, string>, key: string): Promise<YtListResponse<T>> {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${path}?${qs.toString()}`, {
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  const data = (await res.json()) as YtListResponse<T>;
  if (!res.ok) {
    // Surface YouTube's own reason (commentsDisabled, quotaExceeded, etc.).
    const reason = data.error?.errors?.[0]?.reason || '';
    const err = new Error(reason || data.error?.message || `HTTP ${res.status}`);
    (err as Error & { reason?: string; status?: number }).reason = reason;
    (err as Error & { reason?: string; status?: number }).status = res.status;
    throw err;
  }
  return data;
}

export async function POST(req: NextRequest) {
  // Gate: require a valid session.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'YouTube API key is not configured on the server. Set YOUTUBE_API_KEY.' },
      { status: 500 }
    );
  }

  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const videoId = extractVideoId(body.url || '');
  if (!videoId) {
    return NextResponse.json(
      { error: 'Paste a valid YouTube video URL (watch, youtu.be, or shorts) or an 11-character video id.' },
      { status: 400 }
    );
  }

  const exported_at = new Date().toISOString();
  const post_url = `https://www.youtube.com/watch?v=${videoId}`;

  // Look up the video's channel (post_author) — 1 quota unit, and confirms the
  // video exists / is public.
  let post_author = '';
  try {
    const vid = await ytGet<{ snippet?: { channelTitle?: string } }>(
      'videos',
      { part: 'snippet', id: videoId },
      key
    );
    if (!vid.items || vid.items.length === 0) {
      return NextResponse.json({ error: 'Video not found or is private.' }, { status: 404 });
    }
    post_author = vid.items[0].snippet?.channelTitle || '';
  } catch (e) {
    return handleYtError(e);
  }

  const ctx = { post_url, post_id: videoId, post_author, exported_at };
  const rows: YtRow[] = [];
  // Thread ids whose replies were truncated (>5) and need a second-pass fetch.
  const needFullReplies: string[] = [];

  // 1) Page through all top-level comment threads.
  try {
    let pageToken: string | undefined;
    // Safety ceiling so a runaway video can't burn the whole quota in one call.
    let pages = 0;
    do {
      const params: Record<string, string> = {
        part: 'snippet,replies',
        videoId,
        maxResults: '100',
        order: 'time',
        textFormat: 'plainText',
      };
      if (pageToken) params.pageToken = pageToken;

      const data = await ytGet<YtThreadItem>('commentThreads', params, key);
      for (const item of data.items || []) {
        const top = item.snippet?.topLevelComment;
        const total = item.snippet?.totalReplyCount || 0;
        if (top) rows.push(rowFromComment(top, ctx, 0, '', total));

        // Replies included inline (up to 5). If more exist, fetch them fully later.
        const inlineReplies = item.replies?.comments || [];
        if (total > inlineReplies.length && top?.id) {
          needFullReplies.push(top.id);
        } else {
          for (const r of inlineReplies) {
            rows.push(rowFromComment(r, ctx, 1, top?.id || '', 0));
          }
        }
      }
      pageToken = data.nextPageToken;
      pages++;
    } while (pageToken && pages < 200); // 200 pages = up to 20k top-level comments
  } catch (e) {
    return handleYtError(e);
  }

  // 2) Second pass: for threads with >5 replies, fetch the full reply set.
  try {
    for (const parentId of needFullReplies) {
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const params: Record<string, string> = {
          part: 'snippet',
          parentId,
          maxResults: '100',
          textFormat: 'plainText',
        };
        if (pageToken) params.pageToken = pageToken;
        const data = await ytGet<YtComment>('comments', params, key);
        for (const r of data.items || []) {
          rows.push(rowFromComment(r, ctx, 1, parentId, 0));
        }
        pageToken = data.nextPageToken;
        pages++;
      } while (pageToken && pages < 100);
    }
  } catch (e) {
    // Partial success: we have top-level + some replies. Report what we have
    // rather than failing the whole export.
    const partial = handleYtErrorMessage(e);
    return NextResponse.json({
      rows,
      meta: {
        video_id: videoId, post_author, post_url,
        captured: rows.length, exported_at,
        partial: true, note: `Some replies could not be fetched: ${partial}`,
      },
    });
  }

  return NextResponse.json({
    rows,
    meta: {
      video_id: videoId,
      post_author,
      post_url,
      captured: rows.length,
      exported_at,
      partial: false,
    },
  });
}

// Map YouTube API errors to friendly messages + status codes.
function handleYtError(e: unknown): NextResponse {
  const reason = (e as { reason?: string }).reason || '';
  const msg = handleYtErrorMessage(e);
  let status = 502;
  if (reason === 'commentsDisabled') status = 409;
  else if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded') status = 429;
  else if (reason === 'videoNotFound') status = 404;
  else if (reason === 'forbidden') status = 403;
  return NextResponse.json({ error: msg }, { status });
}

function handleYtErrorMessage(e: unknown): string {
  const reason = (e as { reason?: string }).reason || '';
  switch (reason) {
    case 'commentsDisabled': return 'Comments are disabled on this video.';
    case 'quotaExceeded': return 'The daily YouTube API quota is used up. Try again after it resets (midnight Pacific).';
    case 'rateLimitExceeded': return 'YouTube rate-limited this request. Wait a moment and try again.';
    case 'videoNotFound': return 'Video not found or is private.';
    case 'forbidden': return 'YouTube refused this request. Check the API key restrictions.';
    default: return (e as Error).message || 'YouTube API error.';
  }
}