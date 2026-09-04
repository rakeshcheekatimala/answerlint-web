import { afterEach, describe, expect, it } from "vitest";

import {
  checkGlobalRateLimit,
  GlobalRateLimitConfigurationError,
  resetGlobalRateLimitCache,
} from "@/lib/net/global-rate-limit";

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

describe("global rate limiting", () => {
  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    resetGlobalRateLimitCache();
  });

  it("fails closed when a costly production boundary requires shared state", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(
      checkGlobalRateLimit("paid-workflow", {
        limit: 1,
        windowMs: 60_000,
        requireShared: true,
      }),
    ).rejects.toBeInstanceOf(GlobalRateLimitConfigurationError);
  });

  it("retains the local limiter for development-only workflows", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(
      checkGlobalRateLimit("local-workflow", { limit: 1, windowMs: 60_000 }),
    ).resolves.toMatchObject({ allowed: true, remaining: 0 });
  });
});
