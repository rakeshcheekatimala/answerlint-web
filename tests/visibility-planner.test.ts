import { describe, expect, it } from "vitest";

import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import { applyProjectApprovals } from "@/lib/visibility/lifecycle";
import { defaultRuntimePolicy, type VisibilityIntake } from "@/lib/visibility/schema";

function intake(overrides: Partial<VisibilityIntake> = {}): VisibilityIntake {
  return {
    brandUrl: "https://example.com",
    brandName: "Example",
    description: "Compliance automation for growing SaaS companies.",
    primaryCategory: "compliance automation",
    targetCustomers: "mid-market SaaS security teams",
    keyUseCases: ["prepare for SOC 2", "compare compliance tools"],
    revenueGoal: "pipeline",
    competitors: [{ name: "Rival", url: "https://rival.example" }],
    markets: ["US"],
    languages: ["en"],
    surfaces: ["chatgpt_search"],
    runtimePolicy: defaultRuntimePolicy(),
    ...overrides,
  };
}

describe("AI Visibility planning", () => {
  it("creates a compact, explainable Topic Map and Prompt Lab", () => {
    const project = createVisibilityProjectDraft(intake());

    expect(project.state).toBe("awaiting_brand_approval");
    expect(project.brandCard.initialOwnedAssets[0]).toMatchObject({
      url: "https://example.com/",
      verificationStatus: "pending",
    });
    expect(project.topics).toHaveLength(4);
    expect(project.prompts).toHaveLength(8);
    expect(project.prompts.filter((prompt) => prompt.kind === "comparison")[0]).toMatchObject({
      kind: "comparison",
      competitorEntities: ["Rival"],
      plannedSamples: 3,
    });
    expect(project.prompts.reduce((total, prompt) => total + prompt.plannedSamples, 0)).toBe(24);
  });

  it("requires both human approval gates before a benchmark is ready", () => {
    const project = createVisibilityProjectDraft(intake());
    const cardApproved = applyProjectApprovals(project, { brandCard: true });
    const ready = applyProjectApprovals(cardApproved, {
      topicIds: cardApproved.topics.slice(0, 2).map((topic) => topic.id),
    });

    expect(cardApproved.state).toBe("awaiting_topic_approval");
    expect(ready.state).toBe("ready_to_benchmark");
    expect(ready.topics.filter((topic) => topic.included)).toHaveLength(2);
    expect(ready.brandCard.approvalStatus).toBe("approved");
  });
});
