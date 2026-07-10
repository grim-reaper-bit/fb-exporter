// lib/ratelimit.ts
// A small in-memory rate limiter for auth endpoints. Keyed by client IP.
//
// Note: in-memory means the counter is per-server-instance. On Vercel's
// serverless model this isn't a global limiter, but it still meaningfully
// throttles rapid brute-force bursts hitting the same warm instance, which is
// the common attack shape. For a small private site this is a proportionate
// defense; a distributed limiter (e.g. Upstash Redis) would be the next step
// if this ever needs to be bulletproof across all instances.

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

// Periodically drop stale buckets so the map can't grow unbounded.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * Returns { ok, retryAfter }. If ok is false, the caller should reject with 429.
 * @param key    unique key (e.g. `login:1.2.3.4`)
 * @param limit  max attempts per window
 * @param windowSec  window length in seconds
 */
export function rateLimit(key: string, limit = 10, windowSec = 60): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}