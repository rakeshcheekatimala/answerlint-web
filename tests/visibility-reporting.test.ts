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

  it("adds only evidence-qualified CrewAI actions to the customer queue", () => {
    const project = createVisibilityProjectDraft(intake);
    const prompt = project.prompts[0];
    const topic = project.topics[0];
    const evidence = {
      runs: [1, 2, 3].map((repetition) => ({
        runId: `crew-run-${repetition}`,
        promptId: prompt.id,
        topicId: topic.id,
        surface: "chatgpt_search" as const,
        market: "US",
        language: "en",
        observation: {
          runId: `crew-run-${repetition}`,
          answerObserved: true,
          brandMentioned: true,
          competitorMentions: [],
          recommendationStrength: "mentioned" as const,
          rankedPosition: null,
          citations: [],
          confidence: "high" as const,
          claimVerified: true,
          signal: "Observed.",
        },
        citations: [],
      })),
    };
    const report = buildVisibilityWorkspaceReport(project, evidence, {
      analysisId: "analysis-123",
      projectId: project.id,
      status: "completed",
      modelRuntime: "test/model",
      promptVersion: "test/1",
      executiveHeadline: "A supported decision",
      executiveSummary: "Evidence supports one action and one unresolved signal.",
      primaryRisk: null,
      findings: [],
      customerPainThemes: [],
      brandVoice: [],
      executiveDecisions: [],
      actions: ["medium", "insufficient"].map((confidence) => ({
        title: `${confidence} confidence action`,
        whyNow: "The answer exposes a decision gap.",
        owner: "content" as const,
        effort: "medium" as const,
        stakes: "high" as const,
        businessOutcome: "conversion" as const,
        decisionMakers: ["product" as const],
        valueHypothesis: "Clear proof may reduce buyer uncertainty.",
        costOfInaction: "The gap remains visible in buyer answers.",
        impactHorizon: "this_quarter" as const,
        evidenceThesis: "A direct proof block may improve retrieval of the approved claim.",
        alternativesConsidered: ["The small cohort may explain the gap."],
        doNotDo: ["Do not publish unsupported claims."],
        falsificationRule: "Reject the thesis if the locked cohort does not change.",
        linkedPageUrl: "https://example.com/",
        acceptanceCriteria: ["Add reviewed proof"],
        retestRule: "Repeat the locked cohort.",
        affectedPromptIds: [prompt.id],
        evidenceRunIds: ["crew-run-1"],
        sourceUrls: [],
        confidence: confidence as "medium" | "insufficient",
      })),
      limitations: [],
    });

    expect(report.crewAnalysis?.executiveHeadline).toBe("A supported decision");
    expect(report.actions.some((action) => action.action === "medium confidence action")).toBe(true);
    expect(report.actions.some((action) => action.action === "insufficient confidence action")).toBe(false);
  });

  it("keeps the one-page report blank until repeats finish", () => {
    const project = createVisibilityProjectDraft(intake);
    const waiting = buildVisibilityWorkspaceReport(project);
    expect(waiting.leadership.status).toBe("waiting");
    expect(waiting.leadership.citationShare.every((row) => row.share === null)).toBe(true);
    expect(waiting.leadership.citationShare.map((row) => row.name)).toEqual(["Example", "Rival"]);
    expect(waiting.leadership.missingPrompts).toEqual([]);
    expect(waiting.leadership.fixes).toEqual([]);
    expect(waiting.leadership.technicalChecks.map((check) => check.status)).toContain("waiting");

    const prompt = project.prompts[0];
    const partial = buildVisibilityWorkspaceReport(project, {
      runs: [
        {
          runId: "partial-1",
          promptId: prompt.id,
          topicId: prompt.topicId,
          surface: "chatgpt_search",
          market: "US",
          language: "en",
          observation: {
            runId: "partial-1",
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
              url: "https://www.rival.example/comparison",
              canonicalUrl: "https://www.rival.example/comparison",
              title: "Rival",
              excerpt: null,
              sourceType: "competitor",
              resolved: true,
              verificationStatus: "claim_supported",
              supportsClaim: true,
            },
          ],
        },
      ],
    });

    expect(partial.leadership.status).toBe("partial");
    expect(partial.leadership.missingPrompts).toEqual([]);
    expect(partial.leadership.fixes).toEqual([]);
    expect(partial.leadership.citationShare.every((row) => row.share === null)).toBe(true);
    expect(partial.leadership.citationNote).toContain("resolved so far");
  });

  it("reports citation share, missing prompts, the technical check, and ranked fixes", () => {
    const project = createVisibilityProjectDraft(intake);
    const prompt = project.prompts[0];
    const citations = [
      {
        url: "https://example.com/proof",
        canonicalUrl: "https://example.com/proof",
        title: "Proof",
        excerpt: "Example",
        sourceType: "owned" as const,
        resolved: true,
        verificationStatus: "claim_supported" as const,
        supportsClaim: true,
      },
      {
        url: "https://www.rival.example/a",
        canonicalUrl: "https://www.rival.example/a",
        title: "Rival A",
        excerpt: "Rival",
        sourceType: "competitor" as const,
        resolved: true,
        verificationStatus: "claim_supported" as const,
        supportsClaim: true,
      },
      {
        url: "https://blog.rival.example/b",
        canonicalUrl: "https://blog.rival.example/b",
        title: "Rival B",
        excerpt: "Rival",
        sourceType: "competitor" as const,
        resolved: true,
        verificationStatus: "claim_supported" as const,
        supportsClaim: true,
      },
      {
        url: "https://press.example/story",
        canonicalUrl: "https://press.example/story",
        title: "Press",
        excerpt: null,
        sourceType: "earned" as const,
        resolved: true,
        verificationStatus: "citation_resolved" as const,
        supportsClaim: false,
      },
    ];
    const report = buildVisibilityWorkspaceReport(project, {
      runs: [1, 2, 3].map((repetition) => ({
        runId: `share-${repetition}`,
        promptId: prompt.id,
        topicId: prompt.topicId,
        surface: "chatgpt_search" as const,
        market: "US",
        language: "en",
        observation: {
          runId: `share-${repetition}`,
          answerObserved: true,
          brandMentioned: false,
          competitorMentions: ["Rival"],
          recommendationStrength: "none" as const,
          rankedPosition: null,
          citations: [],
          confidence: "high" as const,
          claimVerified: false,
          signal: "Observed.",
        },
        citations: repetition === 1 ? citations : [],
      })),
    });

    const share = report.leadership.citationShare;
    expect(share.map((row) => [row.name, row.share])).toEqual([
      ["Example", 25],
      ["Rival", 50],
      ["Other cited sources", 25],
    ]);
    expect(share.reduce((sum, row) => sum + (row.share ?? 0), 0)).toBe(100);
    expect(report.leadership.missingPrompts).toEqual([
      expect.objectContaining({
        promptId: prompt.id,
        citedInstead: ["Rival"],
        runs: 3,
      }),
    ]);
    expect(report.leadership.fixes[0]).toMatchObject({
      rank: 1,
      why: expect.stringContaining("competitor source was cited"),
    });
    expect(report.leadership.fixes.length).toBeLessThanOrEqual(5);
    expect(report.leadership.fixes.some((fix) => fix.title.startsWith("Replace citations"))).toBe(true);
    expect(report.leadership.technicalChecks.find((check) => check.id === "owned-cited")?.status).toBe("pass");
    expect(report.leadership.technicalChecks.find((check) => check.id === "claim-support")?.status).toBe("partial");
    expect(report.leadership.headline).toContain("25% of resolved citations");
    expect(report.leadership.headline).toContain("Missing from 1 of");
  });
});
