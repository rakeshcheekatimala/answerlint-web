import { describe, expect, it } from "vitest";

import { upsertDiscoveredPage } from "@/lib/business-scan/discovery";
import type { BusinessScanPage } from "@/lib/business-scan/types";

describe("business scan discovery", () => {
  it("deduplicates pages that resolve to the same final URL", () => {
    const pages: BusinessScanPage[] = [
      page({
        id: "2d498f66722d1c09",
        url: "https://react.dev/reference/react",
        source: "sitemap",
        incomingInternalLinks: 1,
      }),
    ];

    upsertDiscoveredPage(
      pages,
      page({
        id: "2d498f66722d1c09",
        url: "https://react.dev/reference/react",
        source: "internal_link",
        incomingInternalLinks: 4,
        isNavigationLinked: true,
      }),
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      id: "2d498f66722d1c09",
      incomingInternalLinks: 4,
      isNavigationLinked: true,
    });
  });

  it("keeps saved manual category decisions when upserting refreshed pages", () => {
    const pages: BusinessScanPage[] = [];
    const saved = page({
      id: "manual",
      url: "https://react.dev/reference/react-dom",
      category: "Revenue Pages",
      impactTier: "Very High",
      is_manually_categorized: true,
      reason: "User marked this as commercially important.",
    });

    upsertDiscoveredPage(
      pages,
      page({
        id: "manual",
        url: "https://react.dev/reference/react-dom",
        category: "Developer Pages",
        impactTier: "High",
      }),
      [saved],
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      category: "Revenue Pages",
      impactTier: "Very High",
      reason: "User marked this as commercially important.",
    });
  });
});

function page(input: Partial<BusinessScanPage>): BusinessScanPage {
  return {
    id: input.id ?? "page",
    url: input.url ?? "https://react.dev/",
    title: input.title ?? "React",
    category: input.category ?? "Developer Pages",
    impactTier: input.impactTier ?? "High",
    included: input.included ?? true,
    is_manually_categorized: input.is_manually_categorized ?? false,
    reason: input.reason ?? "Detected documentation structure.",
    confidence: input.confidence ?? 0.9,
    signals: input.signals ?? [],
    source: input.source ?? "sitemap",
    incomingInternalLinks: input.incomingInternalLinks ?? 0,
    isNavigationLinked: input.isNavigationLinked ?? false,
    isHomepageLinked: input.isHomepageLinked ?? false,
    lastCheckedAt: input.lastCheckedAt ?? "2026-01-01T00:00:00.000Z",
  };
}
