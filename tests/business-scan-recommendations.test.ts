import { describe, expect, it } from "vitest";

import { buildFixFirstRecommendations } from "@/lib/business-scan/recommendations";
import type { BusinessPageAudit, BusinessScanPage } from "@/lib/business-scan/types";
import type { SiteOpsReport } from "@/lib/siteops/types";

describe("business scan recommendations", () => {
  it("calculates expected score gain from project contribution and sorts fix-first items", () => {
    const page = makePage();
    const recommendations = buildFixFirstRecommendations({
      audits: [
        {
          page,
          report: makeReport([
            {
              id: "direct_answer",
              title: "Direct answer in first paragraph",
              weight: 1.5,
            },
            {
              id: "faq_schema",
              title: "FAQ / HowTo schema present",
              weight: 1.5,
            },
          ]),
        } satisfies BusinessPageAudit,
      ],
      pageContributions: [
        {
          pageId: page.id,
          category: page.category,
          pageScore: 60,
          projectWeight: 0.5,
          projectPoints: 30,
          recoverableProjectPoints: 20,
        },
      ],
    });

    // Gains partition the page's recoverable pool (20) across its two failing
    // audits by their relative fractions (0.35 and 0.28, sum 0.63):
    //   direct_answer: 20 * 0.35 / 0.63 = 11.1
    //   faq_schema:    20 * 0.28 / 0.63 = 8.9
    expect(recommendations[0]).toMatchObject({
      issue: "Improve answer structure",
      effort: "Low",
      expectedScoreGain: 11.1,
    });
    expect(recommendations[0].why).toContain("Very High impact revenue page");
    expect(recommendations[1].expectedScoreGain).toBe(8.9);
    // The per-page gains must sum to the recoverable pool, not exceed it.
    expect(
      recommendations[0].expectedScoreGain + recommendations[1].expectedScoreGain,
    ).toBeCloseTo(20, 1);
  });

  it("falls back to audit titles and actions when no recommendation exists", () => {
    const page = makePage();
    const recommendations = buildFixFirstRecommendations({
      audits: [
        {
          page,
          report: makeReport(
            [
              {
                id: "custom_gap",
                title: "Custom visibility gap",
                weight: 1,
              },
              {
                id: "citation_likelihood",
                title: "Citation likelihood",
                weight: 1.3,
              },
            ],
            false,
          ),
        } satisfies BusinessPageAudit,
      ],
      pageContributions: [
        {
          pageId: page.id,
          category: page.category,
          pageScore: 80,
          projectWeight: 0.25,
          projectPoints: 20,
          recoverableProjectPoints: 5,
        },
      ],
    });

    // recoverable 5, fractions custom_gap (default 0.1) + citation (0.22) = 0.32:
    //   custom_gap: 5 * 0.1 / 0.32 = 1.6
    expect(recommendations).toContainEqual(
      expect.objectContaining({
        issue: "Custom visibility gap",
        effort: "Medium",
        expectedScoreGain: 1.6,
        suggestedAction:
          "Improve custom visibility gap to recover visibility points.",
      }),
    );
    expect(recommendations).toContainEqual(
      expect.objectContaining({
        issue: "Improve citation readiness",
        effort: "High",
      }),
    );
  });
});

function makePage(): BusinessScanPage {
  return {
    id: "pricing",
    url: "https://example.com/pricing",
    title: "Pricing",
    category: "Revenue Pages",
    impactTier: "Very High",
    included: true,
    is_manually_categorized: false,
    reason: "Detected pricing intent.",
    confidence: 0.9,
    signals: [],
    source: "navigation",
    incomingInternalLinks: 4,
    isNavigationLinked: true,
    isHomepageLinked: true,
    score: 60,
  };
}

function makeReport(
  failedAudits: Array<{ id: string; title: string; weight: number }>,
  includeRecommendation = true,
): SiteOpsReport {
  return {
    url: "https://example.com/pricing",
    timestamp: "2026-01-01T00:00:00.000Z",
    scores: {
      aeo: 60,
      geo: 60,
      composite: 60,
      band: "needs-improvement",
      percentile: null,
    },
    audits: failedAudits.map((audit) => ({
      ...audit,
      category: "aeo",
      status: "fail",
      score: 0,
      evidence: "Missing signal.",
      recommendation: includeRecommendation
        ? {
            priority: "high",
            score_impact: 8,
            instruction: `Fix ${audit.title}.`,
          }
        : undefined,
    })),
    probe: {
      enabled: false,
      results: [],
    },
  };
}
