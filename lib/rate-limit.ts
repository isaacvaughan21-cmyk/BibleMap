/**
 * In-memory rate limiter for v1. Max 5 attempts per key per 10 minutes.
 *
 * Good enough for a single-instance prelaunch deploy. For multi-instance /
 * serverless production, swap the Map for Upstash Redis (same interface).
 *
 * NOTE: On Vercel's serverless runtime each instance has its own memory, so
 * this is best-effort. The unique constraint on `email` is the real backstop
 * against duplicates; this just blunts rapid abuse.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterMs: 0 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/** Occasional cleanup so the Map doesn't grow unbounded in a long-lived process. */
export function sweepRateLimit(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}
