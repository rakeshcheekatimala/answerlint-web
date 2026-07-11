import { beforeEach, describe, expect, it } from "vitest";

import {
  checkRateLimit,
  getClientKey,
  resetRateLimits,
} from "@/lib/net/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit and blocks the next one", () => {
    const opts = { limit: 3, windowMs: 1000, now: 0 };
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);

    const blocked = checkRateLimit("k", opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("recovers after the window slides forward", () => {
    checkRateLimit("k", { limit: 1, windowMs: 1000, now: 0 });
    expect(checkRateLimit("k", { limit: 1, windowMs: 1000, now: 500 }).allowed).toBe(
      false,
    );
    expect(checkRateLimit("k", { limit: 1, windowMs: 1000, now: 1500 }).allowed).toBe(
      true,
    );
  });

  it("tracks distinct keys independently", () => {
    expect(checkRateLimit("a", { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(
      true,
    );
    expect(checkRateLimit("b", { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(
      true,
    );
  });
});

describe("getClientKey", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const request = new Request("https://x.test", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(getClientKey(request, "scope")).toBe("scope:203.0.113.9");
  });

  it("falls back to x-real-ip then unknown", () => {
    const withReal = new Request("https://x.test", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(getClientKey(withReal, "scope")).toBe("scope:198.51.100.7");

    const withNothing = new Request("https://x.test");
    expect(getClientKey(withNothing, "scope")).toBe("scope:unknown");
  });
});
