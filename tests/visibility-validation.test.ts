import { describe, expect, it } from "vitest";

import { defaultRuntimePolicy } from "@/lib/visibility/schema";
import {
  InvalidVisibilityInputError,
  parseVisibilityIntake,
} from "@/lib/visibility/validation";

const validInput = {
  brandUrl: "https://example.com",
  brandName: "Example",
  description: "",
  primaryCategory: "compliance software",
  targetCustomers: "SaaS security teams",
  keyUseCases: ["prepare for SOC 2"],
  revenueGoal: "pipeline",
  competitors: [],
  markets: ["US"],
  languages: ["en"],
  surfaces: ["chatgpt_search"],
  runtimePolicy: defaultRuntimePolicy(),
};

describe("AI Visibility intake validation", () => {
  it("normalizes empty competitor rows away", () => {
    const parsed = parseVisibilityIntake({
      ...validInput,
      competitors: [{ name: "  ", url: "" }],
    });

    expect(parsed.competitors).toEqual([]);
  });

  it("rejects non-http URLs before a project can be created", () => {
    expect(() =>
      parseVisibilityIntake({ ...validInput, brandUrl: "file:///etc/passwd" }),
    ).toThrow(InvalidVisibilityInputError);
  });
});
