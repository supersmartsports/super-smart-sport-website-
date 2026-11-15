/**
 * A small fixed-window rate limiter held in memory. It slows down password guessing and form
 * spam on a single server. On a platform that runs many short-lived instances, each instance
 * counts separately, so pair it with the host's own rate limiting in production.
 */
type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 5000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: current.count <= limit ? 0 : Math.ceil((current.resetAt - now) / 1000),
  };
}

/** For tests. */
export function resetRateLimits() {
  windows.clear();
}
