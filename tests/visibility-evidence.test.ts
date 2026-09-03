import { describe, expect, it } from "vitest";

import {
  assessObservation,
  canonicalizeEvidenceUrl,
  canMarkActionable,
  evidenceConfidence,
} from "@/lib/visibility/evidence";

describe("AI Visibility evidence gate", () => {
  it("canonicalizes a citation URL before it is used as evidence", () => {
    expect(
      canonicalizeEvidenceUrl("https://Example.com/path/?utm_source=test&ref=keep#section"),
    ).toBe("https://example.com/path?ref=keep");
  });

  it("withholds an action when a source or repeat requirement is missing", () => {
    const observation = assessObservation({
      runId: "run-1",
      rawAnswer: "Example is a good option.",
      brandMentioned: true,
      competitorMentions: [],
      recommendationStrength: "mentioned",
      citations: [
        {
          url: "https://example.com",
          canonicalUrl: "https://example.com/",
          title: "Example",
          excerpt: null,
          sourceType: "owned",
          resolved: true,
          supportsClaim: true,
        },
      ],
      completedRepeatCount: 1,
      requiredRepeatCount: 3,
    });

    expect(observation.confidence).toBe("insufficient");
    expect(observation.signal).toContain("not yet strong enough");
    expect(canMarkActionable(observation)).toBe(false);
  });

  it("permits actionable evidence only after every verification gate passes", () => {
    const observation = assessObservation({
      runId: "run-2",
      rawAnswer: "Example is recommended for this workflow.",
      brandMentioned: true,
      competitorMentions: [],
      recommendationStrength: "recommended",
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
      completedRepeatCount: 3,
      requiredRepeatCount: 3,
    });

    expect(evidenceConfidence({
      answerObserved: true,
      citationExtracted: true,
      sourceResolved: true,
      claimVerified: true,
      completedRepeatCount: 3,
      requiredRepeatCount: 3,
    })).toBe("high");
    expect(canMarkActionable(observation)).toBe(true);
  });
});
