import { describe, expect, it } from "vitest";

import {
  computeBusinessVisibilityScore,
  formatScoringMix,
  summarizeReviewState,
} from "@/lib/business-scan/scoring";
import type { BusinessScanPage } from "@/lib/business-scan/types";

describe("business scan scoring", () => {
  it("redistributes inactive category budgets across active categories", () => {
    const result = computeBusinessVisibilityScore([
      page({ id: "pricing", category: "Revenue Pages", score: 80 }),
      page({ id: "about", category: "Trust Pages", impactTier: "High", score: 60 }),
      page({ id: "faq", category: "Support Pages", impactTier: "Medium", score: 100 }),
      page({ id: "blog", category: "Content Pages", impactTier: "Low", score: 50 }),
    ]);

    expect(result.currentScore).toBe(74.4);
    expect(
      result.scoringMix.find((category) => category.category === "Developer Pages")
        ?.redistributed,
    ).toBe(true);
    expect(
      result.scoringMix.find((category) => category.category === "Revenue Pages")
        ?.activeWeight,
    ).toBe(0.5);
  });

  it("uses impact shares within each category", () => {
    const result = computeBusinessVisibilityScore([
      page({
        id: "pricing",
        category: "Revenue Pages",
        impactTier: "Very High",
        score: 100,
      }),
      page({
        id: "landing",
        category: "Revenue Pages",
        impactTier: "Low",
        score: 0,
      }),
    ]);

    expect(result.currentScore).toBe(80);
    expect(
      result.pageContributions.find((item) => item.pageId === "pricing")
        ?.projectWeight,
    ).toBe(0.8);
    expect(
      result.pageContributions.find((item) => item.pageId === "landing")
        ?.projectWeight,
    ).toBe(0.2);
  });

  it("reports guardrails when no pages are active", () => {
    const pages = [
      page({
        id: "privacy",
        category: "Low Priority / Legal",
        impactTier: "Ignored",
        included: false,
      }),
    ];
    const result = computeBusinessVisibilityScore(pages);
    const summary = summarizeReviewState(pages);

    expect(result.currentScore).toBe(0);
    expect(result.excludedCategoryMessages[0]).toContain("Include at least one");
    expect(summary.hasNoIncludedPages).toBe(true);
  });

  it("formats active and excluded scoring mix labels", () => {
    const result = computeBusinessVisibilityScore([
      page({ id: "pricing", category: "Revenue Pages", score: 80 }),
    ]);

    expect(formatScoringMix(result.scoringMix)).toContainEqual({
      category: "Revenue Pages",
      label: "100%",
    });
    expect(formatScoringMix(result.scoringMix)).toContainEqual({
      category: "Developer Pages",
      label: "Excluded",
    });
  });
});

function page(
  input: Partial<BusinessScanPage> & Pick<BusinessScanPage, "id" | "category">,
): BusinessScanPage {
  return {
    id: input.id,
    url: `https://example.com/${input.id}`,
    title: input.id,
    category: input.category,
    impactTier: input.impactTier ?? "Very High",
    included: input.included ?? true,
    is_manually_categorized: input.is_manually_categorized ?? false,
    reason: input.reason ?? "Test page",
    confidence: input.confidence ?? 0.9,
    signals: input.signals ?? [],
    source: input.source ?? "sitemap",
    incomingInternalLinks: input.incomingInternalLinks ?? 0,
    isNavigationLinked: input.isNavigationLinked ?? false,
    isHomepageLinked: input.isHomepageLinked ?? false,
    score: input.score,
  };
}
