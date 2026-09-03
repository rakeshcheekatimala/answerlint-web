import { afterEach, describe, expect, it } from "vitest";

import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";

describe("AI Visibility feature flag", () => {
  const publicFlag = process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY;
  const serverFlag = process.env.ENABLE_AI_VISIBILITY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY = publicFlag;
    process.env.ENABLE_AI_VISIBILITY = serverFlag;
  });

  it("is disabled by default", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY;
    delete process.env.ENABLE_AI_VISIBILITY;

    expect(isVisibilityEnabled()).toBe(false);
  });

  it("requires an explicit true value", () => {
    process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY = "true";
    expect(isVisibilityEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY = "false";
    expect(isVisibilityEnabled()).toBe(false);
  });
});
