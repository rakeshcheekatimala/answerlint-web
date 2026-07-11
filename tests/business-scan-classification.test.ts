import { describe, expect, it } from "vitest";

import {
  classifyBusinessPage,
  createBusinessScanPage,
  mergePageRefresh,
} from "@/lib/business-scan/classification";

describe("business scan classification", () => {
  it("classifies conversion pages as revenue pages", () => {
    const result = classifyBusinessPage({
      url: "https://example.com/pricing",
      title: "Pricing and plans",
      source: "navigation",
      isNavigationLinked: true,
      isHomepageLinked: true,
    });

    expect(result.category).toBe("Revenue Pages");
    expect(result.impactTier).toBe("Very High");
    expect(result.included).toBe(true);
    expect(result.reason).toContain("conversion");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("ignores legal pages by default", () => {
    const result = classifyBusinessPage({
      url: "https://example.com/privacy",
      title: "Privacy Policy",
      source: "internal_link",
    });

    expect(result.category).toBe("Low Priority / Legal");
    expect(result.impactTier).toBe("Ignored");
    expect(result.included).toBe(false);
    expect(result.reason).toContain("Legal page detected");
  });

  it("classifies developer, content, homepage, and ambiguous pages", () => {
    expect(
      classifyBusinessPage({
        url: "https://example.com/api/reference",
        title: "API Reference",
        source: "navigation",
        incomingInternalLinks: 4,
        canonicalUrl: "https://example.com/developers/api-reference",
      }).category,
    ).toBe("Developer Pages");

    expect(
      classifyBusinessPage({
        url: "https://example.com/blog/ai-visibility-guide",
        title: "AI visibility guide",
        source: "sitemap",
      }).category,
    ).toBe("Content Pages");

    expect(
      classifyBusinessPage({
        url: "https://example.com/",
        title: "Example",
        source: "base_url",
      }).reason,
    ).toContain("Homepage");

    expect(
      classifyBusinessPage({
        url: "https://example.com/blue",
        title: "Blue",
        source: "internal_link",
      }),
    ).toMatchObject({
      category: "Uncategorized",
      included: false,
      impactTier: "Ignored",
    });
  });

  it("formats a page title from the URL when title is missing", () => {
    const page = createBusinessScanPage({
      id: "page-2",
      url: "https://example.com/contact-sales",
      source: "sitemap",
    });

    expect(page.title).toBe("Contact Sales");
  });

  it("keeps manual category and impact decisions during refresh", () => {
    const existing = createBusinessScanPage({
      id: "page-1",
      url: "https://example.com/docs",
      title: "Docs",
      source: "navigation",
    });
    const refreshed = createBusinessScanPage({
      id: "page-1",
      url: "https://example.com/docs",
      title: "Developer Documentation",
      source: "navigation",
    });
    const manuallyChanged = {
      ...existing,
      category: "Revenue Pages" as const,
      impactTier: "Very High" as const,
      included: true,
      is_manually_categorized: true,
      reason: "User says docs drive revenue.",
    };

    const merged = mergePageRefresh(manuallyChanged, refreshed);

    expect(merged.title).toBe("Developer Documentation");
    expect(merged.category).toBe("Revenue Pages");
    expect(merged.impactTier).toBe("Very High");
    expect(merged.reason).toBe("User says docs drive revenue.");
  });

  it("allows non-manual refreshes to update classification", () => {
    const existing = createBusinessScanPage({
      id: "page-3",
      url: "https://example.com/blue",
      title: "Blue",
      source: "internal_link",
    });
    const refreshed = createBusinessScanPage({
      id: "page-3",
      url: "https://example.com/security",
      title: "Security",
      source: "navigation",
      statusCode: 200,
    });

    const merged = mergePageRefresh(existing, refreshed);

    expect(merged.category).toBe("Trust Pages");
    expect(merged.included).toBe(true);
    expect(merged.statusCode).toBe(200);
  });
});
