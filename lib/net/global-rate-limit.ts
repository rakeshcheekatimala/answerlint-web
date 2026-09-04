import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  checkRateLimit,
  type RateLimitResult,
} from "@/lib/net/rate-limit";

type GlobalRateLimitOptions = {
  limit: number;
  windowMs: number;
  requireShared?: boolean;
  cost?: number;
};

export class GlobalRateLimitConfigurationError extends Error {
  constructor() {
    super("Shared rate limiting is required for this operation.");
    this.name = "GlobalRateLimitConfigurationError";
  }
}

const limiters = new Map<string, Ratelimit>();

function hasUpstashConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function getLimiter(options: GlobalRateLimitOptions): Ratelimit | null {
  if (!hasUpstashConfig()) return null;

  const cacheKey = `${options.limit}:${options.windowMs}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(options.limit, `${options.windowMs} ms`),
    prefix: "answerlint:visibility",
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Uses Upstash for account-wide limits when configured and retains the local
 * limiter as an intentional development fallback. New costly workflows use
 * this asynchronous boundary; existing routes can migrate independently.
 */
export async function checkGlobalRateLimit(
  key: string,
  options: GlobalRateLimitOptions,
): Promise<RateLimitResult> {
  const limiter = getLimiter(options);
  if (!limiter) {
    if (options.requireShared) throw new GlobalRateLimitConfigurationError();
    return checkRateLimit(key, options);
  }

  const result = await limiter.limit(key, {
    rate: Math.max(1, Math.trunc(options.cost ?? 1)),
  });
  return {
    allowed: result.success,
    remaining: Math.max(0, result.remaining),
    retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
  };
}

/** Test helper to avoid sharing a configured limiter across test cases. */
export function resetGlobalRateLimitCache() {
  limiters.clear();
}
