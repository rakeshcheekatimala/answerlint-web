/**
 * A minimal in-memory sliding-window rate limiter.
 *
 * NOTE: This is per-process. On serverless/multi-instance deployments each
 * instance keeps its own counters, so this is a defense-in-depth guardrail
 * rather than a global quota. For a hard global limit, back this with a shared
 * store (e.g. Upstash/Redis). It still meaningfully caps abuse from a single
 * client against a single instance.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Bucket = number[];

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  {
    limit,
    windowMs,
    now = Date.now(),
  }: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((ts) => ts > windowStart);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    buckets.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
    };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);

  return {
    allowed: true,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfterMs: 0,
  };
}

/** Test helper to clear all counters. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Extracts a best-effort client identifier from request headers. Falls back to
 * a constant so the limiter still functions when no proxy headers are present.
 */
export function getClientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  return `${scope}:${ip}`;
}
