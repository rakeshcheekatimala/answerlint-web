import { describe, expect, it } from "vitest";

import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import { defaultRuntimePolicy, type VisibilityIntake } from "@/lib/visibility/schema";
import { buildVisibilityWorkspaceReport } from "@/lib/visibility/reporting";

const intake: VisibilityIntake = {
  brandUrl: "https://example.com",
  brandName: "Example",
  description: "",
  primaryCategory: "compliance software",
  targetCustomers: "SaaS security teams",
  keyUseCases: ["prepare for SOC 2"],
  revenueGoal: "pipeline",
  competitors: [{ name: "Rival", url: "https://rival.example" }],
  markets: ["US"],
  languages: ["en"],
  surfaces: ["chatgpt_search"],
  runtimePolicy: defaultRuntimePolicy(),
};

describe("AI Visibility reporting", () => {
  it("creates an actionable comparison task only from repeat-tested source evidence", () => {
    const project = createVisibilityProjectDraft(intake);
    const prompt = project.prompts[0];
    const topic = project.topics[0];
    const evidence = {
      runs: [1, 2, 3].map((repetition) => ({
        runId: `run-${repetition}`,
        promptId: prompt.id,
        topicId: topic.id,
        surface: "chatgpt_search" as const,
        market: "US",
        language: "en",
        observation: {
          runId: `run-${repetition}`,
          answerObserved: true,
          brandMentioned: false,
          competitorMentions: ["Rival"],
          recommendationStrength: "none" as const,
          rankedPosition: null,
          citations: [],
          confidence: "insufficient" as const,
          claimVerified: true,
          signal: "Observed.",
        },
        citations: [
          {
            url: "https://rival.example/comparison",
            canonicalUrl: "https://rival.example/comparison",
            title: "Rival comparison",
            excerpt: "Rival",
            sourceType: "competitor" as const,
            resolved: true,
            verificationStatus: "claim_supported" as const,
            supportsClaim: true,
          },
        ],
      })),
    };

    const report = buildVisibilityWorkspaceReport(project, evidence);

    expect(report.metrics[0]).toMatchObject({
      label: "Verified mention rate",
      value: 0,
    });
    expect(report.actions).toHaveLength(1);
    expect(report.actions[0]).toMatchObject({
      expectedImpact: "recommendation",
      status: "actionable",
      confidence: "high",
    });
  });

  it("keeps a one-off signal out of the Action Queue", () => {
    const project = createVisibilityProjectDraft(intake);
    const prompt = project.prompts[0];
    const topic = project.topics[0];
    const report = buildVisibilityWorkspaceReport(project, {
      runs: [
        {
          runId: "one-off",
          promptId: prompt.id,
          topicId: topic.id,
          surface: "chatgpt_search",
          market: "US",
          language: "en",
          observation: {
            runId: "one-off",
            answerObserved: true,
            brandMentioned: false,
            competitorMentions: ["Rival"],
            recommendationStrength: "none",
            rankedPosition: null,
            citations: [],
            confidence: "insufficient",
            claimVerified: true,
            signal: "Observed.",
          },
          citations: [
            {
              url: "https://rival.example/comparison",
              canonicalUrl: "https://rival.example/comparison",
              title: "Rival comparison",
              excerpt: "Rival",
              sourceType: "competitor",
              resolved: true,
              supportsClaim: true,
            },
          ],
        },
      ],
    });

    expect(report.actions).toEqual([]);
    expect(report.actionQueueMessage).toContain("not yet strong enough");
  });

  it("does not promote a URL resolution into semantic claim support", () => {
    const project = createVisibilityProjectDraft(intake);
    const prompt = project.prompts[0];
    const topic = project.topics[0];
    const report = buildVisibilityWorkspaceReport(project, {
      runs: [1, 2, 3].map((repetition) => ({
        runId: `resolved-${repetition}`,
        promptId: prompt.id,
        topicId: topic.id,
        surface: "chatgpt_search" as const,
        market: "US",
        language: "en",
        observation: {
          runId: `resolved-${repetition}`,
          answerObserved: true,
          brandMentioned: false,
          competitorMentions: ["Rival"],
          recommendationStrength: "none" as const,
          rankedPosition: null,
          citations: [],
          confidence: "insufficient" as const,
          claimVerified: false,
          signal: "Observed.",
        },
        citations: [{
          url: "https://rival.example/comparison",
          canonicalUrl: "https://rival.example/comparison",
          title: "Rival comparison",
          excerpt: null,
          sourceType: "competitor" as const,
          resolved: true,
          verificationStatus: "citation_resolved" as const,
          supportsClaim: false,
        }],
      })),
    });

    expect(report.actions).toEqual([]);
    expect(report.metrics.map((metric) => metric.label)).toEqual([
      "Verified mention rate",
      "Owned citation share",
    ]);
  });

  it("exposes answer and source rows without promoting no-evidence metrics", () => {
    const project = createVisibilityProjectDraft(intake);
    const prompt = project.prompts[0];
    const topic = project.topics[0];
    const report = buildVisibilityWorkspaceReport(project, {
      runs: [
        {
          runId: "evidence-run",
          promptId: prompt.id,
          topicId: topic.id,
          surface: "chatgpt_search",
          market: "US",
          language: "en",
          modelRuntime: "test-search",
          runAt: "2026-09-04T00:00:00.000Z",
          answerExcerpt: "Example is mentioned in this answer.",
          observation: {
            runId: "evidence-run",
            answerObserved: true,
            brandMentioned: true,
            competitorMentions: [],
            recommendationStrength: "mentioned",
            rankedPosition: null,
            citations: [],
            confidence: "insufficient",
            claimVerified: false,
            signal: "Observed.",
          },
          citations: [
            {
              url: "https://example.com/proof",
              canonicalUrl: "https://example.com/proof",
              title: "Proof",
              excerpt: "Example proof",
              sourceType: "owned",
              resolved: true,
              supportsClaim: true,
            },
          ],
        },
      ],
    });

    expect(report.measurementCoverage).toMatchObject({ completedRuns: 1, plannedRuns: 24 });
    expect(report.evidenceRows[0]).toMatchObject({
      prompt: prompt.text,
      answerExcerpt: "Example is mentioned in this answer.",
    });
    expect(report.sourceRows[0]).toMatchObject({ domain: "example.com", citationCount: 1 });
    expect(report.metrics[0].value).toBeNull();
  });
});
