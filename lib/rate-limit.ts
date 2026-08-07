import "server-only";

interface Bucket {
  count: number;
  resetAt: number;
}

// Simple in-memory rate limiter. Adequate for a single-instance deployment;
// swap for Upstash/Vercel KV in a multi-instance setup.
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(opts.key);
  if (!b || b.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(opts.key, fresh);
    return { ok: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }
  if (b.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { ok: true, remaining: opts.limit - b.count, resetAt: b.resetAt };
}

if (typeof setInterval !== "undefined") {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, 60_000);
  t.unref?.();
}
