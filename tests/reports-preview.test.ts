import { describe, expect, it } from "vitest";

import {
  createComparisonReportPreview,
  createSingleReportPreview,
} from "@/lib/reports/preview";
import type {
  AuditResult,
  SiteOpsComparisonReport,
  SiteOpsReport,
} from "@/lib/siteops/types";

function audit(overrides: Partial<AuditResult>): AuditResult {
  return {
    id: "direct_answer",
    category: "aeo",
    title: "Direct answer",
    status: "warn",
    weight: 1.5,
    score: 50,
    evidence: "Missing a concise answer near the top.",
    recommendation: {
      priority: "high",
      score_impact: 15,
      instruction: "Add a direct answer block.",
    },
    ...overrides,
  };
}

function report(overrides: Partial<SiteOpsReport> = {}): SiteOpsReport {
  return {
    url: "https://example.com/",
    timestamp: "2026-07-04T00:00:00.000Z",
    scores: {
      aeo: 33,
      geo: 46,
      composite: 40,
      band: "poor",
      percentile: null,
    },
    audits: [
      audit({ id: "direct_answer", status: "warn" }),
      audit({ id: "faq_schema", title: "FAQ schema", status: "fail" }),
      audit({ id: "author_byline", title: "Author byline", status: "pass" }),
      audit({ id: "freshness", title: "Freshness", status: "warn" }),
    ],
    probe: { enabled: false, results: [] },
    ...overrides,
  };
}

describe("report previews", () => {
  it("creates a single-audit preview without exposing the full audit payload", () => {
    const preview = createSingleReportPreview(report());

    expect(preview).toMatchObject({
      kind: "single",
      targetUrl: "https://example.com/",
      issueCount: 3,
      passCount: 1,
      scores: { composite: 40, band: "poor" },
    });
    expect(preview.topIssues).toHaveLength(3);
    expect(preview.topIssues[0]).toEqual({
      id: "direct_answer",
      title: "Direct answer",
      status: "warn",
      evidence: "Missing a concise answer near the top.",
      priority: "high",
      scoreImpact: 15,
    });
    expect(JSON.stringify(preview)).not.toContain("Add a direct answer block.");
  });

  it("creates a compact comparison preview with capped insight lists", () => {
    const target = report({ url: "https://target.example/" });
    const competitor = report({
      url: "https://competitor.example/",
      scores: {
        aeo: 70,
        geo: 80,
        composite: 75,
        band: "good",
        percentile: null,
      },
    });
    const comparisonReport: SiteOpsComparisonReport = {
      type: "comparison",
      timestamp: "2026-07-04T00:00:00.000Z",
      target,
      competitor,
      comparison: {
        scores: {
          composite: { target: 40, competitor: 75, delta: -35 },
          aeo: { target: 33, competitor: 70, delta: -37 },
          geo: { target: 46, competitor: 80, delta: -34 },
        },
        leader: {
          role: "competitor",
          label: "Competitor leads",
          score_gap: 35,
          summary: "Competitor leads by 35 points.",
        },
        audit_deltas: [],
        target_advantages: [],
        competitor_advantages: [],
        competitor_edges: Array.from({ length: 4 }, (_, index) => ({
          id: `edge_${index}`,
          category: "geo",
          title: `Edge ${index}`,
          target_status: "warn",
          competitor_status: "pass",
          priority: "high",
          score_impact: 10,
          reason: "Competitor has stronger evidence.",
          action: "Add stronger evidence.",
        })),
        improve_first: Array.from({ length: 4 }, (_, index) => ({
          id: `fix_${index}`,
          category: "aeo",
          title: `Fix ${index}`,
          target_status: "fail",
          competitor_status: "pass",
          priority: "medium",
          score_impact: 8,
          reason: "Target misses this signal.",
          action: "Improve this signal.",
        })),
      },
    };

    const preview = createComparisonReportPreview(comparisonReport);

    expect(preview).toMatchObject({
      kind: "comparison",
      targetUrl: "https://target.example/",
      competitorUrl: "https://competitor.example/",
      leader: { label: "Competitor leads" },
    });
    expect(preview.improveFirst).toHaveLength(3);
    expect(preview.competitorEdges).toHaveLength(3);
    expect(preview.targetScores.composite).toBe(40);
    expect(preview.competitorScores.composite).toBe(75);
  });
});
