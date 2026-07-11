import { describe, expect, it } from "vitest";

import {
  InvalidProjectError,
  sanitizeProjectPayload,
} from "@/lib/business-scan/validation";

function page(overrides: Record<string, unknown>) {
  return {
    id: "p",
    url: "https://example.com/",
    title: "Home",
    category: "Revenue Pages",
    impactTier: "Very High",
    included: true,
    is_manually_categorized: false,
    reason: "",
    confidence: 0.9,
    signals: [],
    source: "sitemap",
    incomingInternalLinks: 0,
    isNavigationLinked: false,
    isHomepageLinked: false,
    ...overrides,
  };
}

function baseProject(pages: unknown[]) {
  return {
    id: "abc",
    baseUrl: "https://example.com",
    pages,
    businessModel: "SaaS Marketing Site",
    scanHistory: [],
    latestScore: null,
    potentialScore: null,
    lostOpportunityScore: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    storageStatus: "skipped",
  };
}

describe("sanitizeProjectPayload", () => {
  it("drops pages whose host does not match the base URL (SSRF allowlist)", () => {
    const result = sanitizeProjectPayload(
      baseProject([
        page({ id: "home", url: "https://example.com/pricing" }),
        page({ id: "ssrf", url: "http://localhost:6379/" }),
        page({ id: "meta", url: "http://169.254.169.254/latest/meta-data" }),
        page({ id: "other", url: "https://evil.example/steal" }),
      ]),
    );

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].url).toBe("https://example.com/pricing");
  });

  it("coerces unknown categories/impact tiers to safe defaults", () => {
    const result = sanitizeProjectPayload(
      baseProject([
        page({
          id: "weird",
          url: "https://example.com/x",
          category: "Bogus",
          impactTier: "Enormous",
        }),
      ]),
    );

    expect(result.pages[0].category).toBe("Uncategorized");
    expect(result.pages[0].impactTier).toBe("Ignored");
  });

  it("rejects payloads with too many pages", () => {
    const many = Array.from({ length: 1001 }, (_, i) =>
      page({ id: `p${i}`, url: `https://example.com/${i}` }),
    );
    expect(() => sanitizeProjectPayload(baseProject(many))).toThrow(
      InvalidProjectError,
    );
  });

  it("rejects a non-object or missing base URL", () => {
    expect(() => sanitizeProjectPayload(null)).toThrow(InvalidProjectError);
    expect(() =>
      sanitizeProjectPayload({ id: "a", pages: [] }),
    ).toThrow(InvalidProjectError);
  });

  it("rejects a base URL that is not a public http(s) URL", () => {
    expect(() =>
      sanitizeProjectPayload({ ...baseProject([]), baseUrl: "file:///etc/passwd" }),
    ).toThrow();
  });
});
