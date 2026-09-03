import { describe, expect, it } from "vitest";

import { parseAnswerSignals } from "@/lib/visibility/observation-parser";

describe("visibility observation parser", () => {
  it("distinguishes a ranked recommendation from a plain mention", () => {
    expect(
      parseAnswerSignals({
        rawAnswer: "Top options:\n#1 Example\n#2 Rival",
        brandName: "Example",
        competitors: ["Rival"],
      }),
    ).toMatchObject({
      brandMentioned: true,
      competitorMentions: ["Rival"],
      recommendationStrength: "ranked",
      rankedPosition: 1,
    });

    expect(
      parseAnswerSignals({
        rawAnswer: "Example has published a new release.",
        brandName: "Example",
        competitors: [],
      }).recommendationStrength,
    ).toBe("mentioned");
  });

  it("avoids partial-name false positives and recognizes nearby recommendation language", () => {
    expect(
      parseAnswerSignals({
        rawAnswer: "Examples are useful, but no vendor is named.",
        brandName: "Example",
        competitors: [],
      }).brandMentioned,
    ).toBe(false);

    expect(
      parseAnswerSignals({
        rawAnswer: "For small security teams, Example is a strong choice.",
        brandName: "Example",
        competitors: [],
      }).recommendationStrength,
    ).toBe("recommended");
  });
});
